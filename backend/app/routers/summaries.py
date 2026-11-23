from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_connection, utc_now
from app.routers.documents import get_db_path
from app.schemas import SummaryGenerateRequest, SummaryResponse
from app.summary_generation import generate_summary_content

router = APIRouter(prefix="/api/workspaces", tags=["summaries"])


@router.get("/{workspace_id}/summaries", response_model=list[SummaryResponse])
def list_summaries(workspace_id: int, db_path: Path = Depends(get_db_path)) -> list[SummaryResponse]:
    with get_connection(db_path) as connection:
        workspace = connection.execute(
            "SELECT id FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        if workspace is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        rows = connection.execute(
            "SELECT id, workspace_id, document_id, content, created_at FROM summaries "
            "WHERE workspace_id = ? ORDER BY id",
            (workspace_id,),
        ).fetchall()
    return [SummaryResponse.model_validate(dict(row)) for row in rows]


@router.post("/{workspace_id}/summaries/generate", response_model=SummaryResponse)
def generate_summary(
    workspace_id: int,
    payload: SummaryGenerateRequest,
    db_path: Path = Depends(get_db_path),
) -> SummaryResponse:
    with get_connection(db_path) as connection:
        workspace = connection.execute(
            "SELECT id FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        if workspace is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        document = connection.execute(
            "SELECT id, filename, content FROM documents WHERE id = ? AND workspace_id = ?",
            (payload.document_id, workspace_id),
        ).fetchone()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found")

    try:
        content = generate_summary_content(
            document["filename"], document["content"], payload.perspective
        )
    except RuntimeError as exc:
        status_code = 503 if "GROQ_API_KEY" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Summary generation failed") from exc

    created_at = utc_now()
    with get_connection(db_path) as connection:
        connection.execute(
            "DELETE FROM summaries WHERE workspace_id = ? AND document_id = ?",
            (workspace_id, payload.document_id),
        )
        cursor = connection.execute(
            "INSERT INTO summaries (workspace_id, document_id, content, created_at) "
            "VALUES (?, ?, ?, ?)",
            (workspace_id, payload.document_id, content, created_at),
        )
        row = connection.execute(
            "SELECT id, workspace_id, document_id, content, created_at FROM summaries WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return SummaryResponse.model_validate(dict(row))
