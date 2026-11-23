from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.database import get_connection, utc_now
from app.schemas import WorkspaceName, WorkspaceResponse
from app.vector_store import delete_workspace_collection

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def get_db_path(request: Request) -> Path:
    return request.app.state.db_path


@router.get("")
def list_workspaces(db_path: Path = Depends(get_db_path)) -> list[dict]:
    with get_connection(db_path) as connection:
        rows = connection.execute(
            "SELECT id, name, created_at, updated_at FROM workspaces ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceName, db_path: Path = Depends(get_db_path)
) -> WorkspaceResponse:
    timestamp = utc_now()
    with get_connection(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO workspaces (name, created_at, updated_at) VALUES (?, ?, ?)",
            (payload.name, timestamp, timestamp),
        )
        row = connection.execute(
            "SELECT id, name, created_at, updated_at FROM workspaces WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return WorkspaceResponse.model_validate(dict(row))


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
def rename_workspace(
    workspace_id: int,
    payload: WorkspaceName,
    db_path: Path = Depends(get_db_path),
) -> WorkspaceResponse:
    with get_connection(db_path) as connection:
        existing = connection.execute(
            "SELECT id FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Workspace not found")

        connection.execute(
            "UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?",
            (payload.name, utc_now(), workspace_id),
        )
        row = connection.execute(
            "SELECT id, name, created_at, updated_at FROM workspaces WHERE id = ?",
            (workspace_id,),
        ).fetchone()
    return WorkspaceResponse.model_validate(dict(row))


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: int,
    request: Request,
    db_path: Path = Depends(get_db_path),
) -> None:
    with get_connection(db_path) as connection:
        existing = connection.execute(
            "SELECT id FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        connection.execute("DELETE FROM workspaces WHERE id = ?", (workspace_id,))

    delete_workspace_collection(request.app.state.chroma_client, workspace_id)
