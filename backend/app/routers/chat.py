import json
import os
import re
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from app.database import get_connection, utc_now
from app.embeddings import embed_texts
from app.schemas import ChatRequest, MessageResponse
from app.vector_store import workspace_collection_name

router = APIRouter(prefix="/api/workspaces", tags=["chat"])
TOP_K = 5
DISTANCE_THRESHOLD = float(os.getenv("CHAT_DISTANCE_THRESHOLD", "1.5"))
MODEL = "openai/gpt-oss-120b"


def get_db_path(request: Request) -> Path:
    return request.app.state.db_path


def _event(event_type: str, data: object) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data}, ensure_ascii=False)}\n\n"


def _sources(request: Request, workspace_id: int, query: str, document_id: int | None) -> list[dict]:
    try:
        collection = request.app.state.chroma_client.get_collection(
            workspace_collection_name(workspace_id)
        )
    except Exception as exc:
        # Chroma's NotFoundError is the expected empty-workspace case.
        from chromadb.errors import NotFoundError

        if isinstance(exc, NotFoundError):
            return []
        raise

    result = collection.query(
        query_embeddings=embed_texts([query]),
        n_results=TOP_K,
        where={"document_id": document_id} if document_id is not None else None,
        include=["documents", "metadatas", "distances"],
    )
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    sources = []
    for text, metadata, distance in zip(documents, metadatas, distances):
        if distance > DISTANCE_THRESHOLD:
            continue
        sources.append({
            "number": len(sources) + 1,
            "document_id": int(metadata["document_id"]),
            "filename": str(metadata.get("filename", "Document")),
            "page": int(metadata.get("page", 1)),
            "snippet": str(text)[:1200],
        })
    return sources


@router.post("/{workspace_id}/chat")
async def chat(
    workspace_id: int,
    payload: ChatRequest,
    request: Request,
    db_path: Path = Depends(get_db_path),
) -> StreamingResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    with get_connection(db_path) as connection:
        workspace = connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone()
        if workspace is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        if payload.document_id is not None:
            document = connection.execute(
                "SELECT id FROM documents WHERE id = ? AND workspace_id = ?",
                (payload.document_id, workspace_id),
            ).fetchone()
            if document is None:
                raise HTTPException(status_code=404, detail="Document not found in workspace")
        connection.execute(
            "INSERT INTO messages (workspace_id, role, content, citations, created_at) VALUES (?, 'user', ?, '[]', ?)",
            (workspace_id, message, utc_now()),
        )

    sources = _sources(request, workspace_id, message, payload.document_id)
    client = getattr(request.app.state, "chat_client", None)
    if client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured")
        client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=api_key)

    source_context = "\n\n".join(
        f"[{item['number']}] {item['filename']}, page {item['page']}: {item['snippet']}"
        for item in sources
    ) or "No relevant passages were found. Say so and do not invent citations."
    history = []
    with get_connection(db_path) as connection:
        rows = connection.execute(
            "SELECT role, content FROM messages WHERE workspace_id = ? ORDER BY id DESC LIMIT 12",
            (workspace_id,),
        ).fetchall()
        history = [{"role": row["role"], "content": row["content"]} for row in reversed(rows)][:-1]

    async def stream() -> AsyncIterator[str]:
        answer = ""
        try:
            completion = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": (
                        "Answer the student's question using the provided source passages. "
                        "Cite factual claims with the exact bracketed source numbers, such as [1] or [1][2]. "
                        "Never cite a source number not provided. If the sources do not answer the question, say so.\n\n"
                        f"Source passages:\n{source_context}"
                    )},
                    *history,
                    {"role": "user", "content": message},
                ],
                stream=True,
            )
            async for chunk in completion:
                token = chunk.choices[0].delta.content if chunk.choices else None
                if token:
                    answer += token
                    yield _event("token", token)

            cited_numbers = sorted({int(number) for number in re.findall(r"\[(\d+)\]", answer)})
            citations = [source for source in sources if source["number"] in cited_numbers]
            for citation in citations:
                yield _event("citation", citation)
            with get_connection(db_path) as connection:
                cursor = connection.execute(
                    "INSERT INTO messages (workspace_id, role, content, citations, created_at) VALUES (?, 'assistant', ?, ?, ?)",
                    (workspace_id, answer, json.dumps(citations), utc_now()),
                )
                message_id = cursor.lastrowid
            yield _event("done", {"id": message_id, "citations": citations})
        except Exception as exc:
            yield _event("error", {"message": str(exc)})

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/{workspace_id}/messages", response_model=list[MessageResponse])
def get_messages(workspace_id: int, db_path: Path = Depends(get_db_path)) -> list[dict]:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        rows = connection.execute(
            "SELECT id, workspace_id, role, content, citations, created_at FROM messages WHERE workspace_id = ? ORDER BY id",
            (workspace_id,),
        ).fetchall()
    return [{**dict(row), "citations": json.loads(row["citations"] or "[]")} for row in rows]


@router.delete("/{workspace_id}/messages", status_code=204)
def clear_messages(workspace_id: int, db_path: Path = Depends(get_db_path)) -> None:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        connection.execute("DELETE FROM messages WHERE workspace_id = ?", (workspace_id,))
