from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.database import get_connection, utc_now
from app.documents import chunk_sections, extract_sections
from app.embeddings import embed_texts
from app.schemas import DocumentResponse
from app.vector_store import (
    count_document_chunks,
    delete_document_chunks,
    get_workspace_collection,
    store_chunks,
)

router = APIRouter(prefix="/api/workspaces", tags=["documents"])

ALLOWED_SUFFIXES = {".pdf", ".docx", ".txt", ".md"}


def get_db_path(request: Request) -> Path:
    return request.app.state.db_path


@router.post(
    "/{workspace_id}/documents",
    response_model=list[DocumentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def upload_documents(
    workspace_id: int,
    request: Request,
    files: list[UploadFile] = File(...),
    db_path: Path = Depends(get_db_path),
) -> list[DocumentResponse]:
    with get_connection(db_path) as connection:
        existing = connection.execute(
            "SELECT id FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
    if existing is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    uploaded: list[DocumentResponse] = []
    for upload in files:
        filename = upload.filename or "document"
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            raise HTTPException(status_code=400, detail=f"Unsupported document type: {suffix or 'unknown'}")

        content = await upload.read()
        try:
            sections = extract_sections(filename, content)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        chunks = chunk_sections(sections)

        uploaded_at = utc_now()
        with get_connection(db_path) as connection:
            cursor = connection.execute(
                "INSERT INTO documents (workspace_id, filename, content, uploaded_at) "
                "VALUES (?, ?, ?, ?)",
                (workspace_id, filename, "\n\n".join(section.text for section in sections), uploaded_at),
            )
            document_id = cursor.lastrowid

        collection = get_workspace_collection(request.app.state.chroma_client, workspace_id)
        store_chunks(
            collection,
            document_id,
            filename,
            chunks,
            embed_texts([chunk.text for chunk in chunks]),
        )
        uploaded.append(
            DocumentResponse(
                id=document_id,
                workspace_id=workspace_id,
                filename=filename,
                uploaded_at=uploaded_at,
                chunk_count=len(chunks),
            )
        )
    return uploaded


@router.get("/{workspace_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    workspace_id: int,
    request: Request,
    db_path: Path = Depends(get_db_path),
) -> list[DocumentResponse]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            "SELECT id, workspace_id, filename, uploaded_at FROM documents "
            "WHERE workspace_id = ? ORDER BY id",
            (workspace_id,),
        ).fetchall()
    return [
        DocumentResponse(
            id=row["id"],
            workspace_id=row["workspace_id"],
            filename=row["filename"],
            uploaded_at=row["uploaded_at"],
            chunk_count=count_document_chunks(
                request.app.state.chroma_client, workspace_id, row["id"]
            ),
        )
        for row in rows
    ]


@router.delete("/{workspace_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    workspace_id: int,
    document_id: int,
    request: Request,
    db_path: Path = Depends(get_db_path),
) -> None:
    with get_connection(db_path) as connection:
        existing = connection.execute(
            "SELECT id FROM documents WHERE id = ? AND workspace_id = ?",
            (document_id, workspace_id),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Document not found")
        connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    delete_document_chunks(request.app.state.chroma_client, workspace_id, document_id)
