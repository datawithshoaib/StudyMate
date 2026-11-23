from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_connection, utc_now
from app.routers.documents import get_db_path
from app.schemas import FlashcardResponse, FlashcardReviewRequest
from app.flashcard_generation import generate_flashcards

router = APIRouter(prefix="/api/workspaces", tags=["flashcards"])


def _workspace_exists(workspace_id: int, db_path: Path) -> None:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")


@router.get("/{workspace_id}/flashcards", response_model=list[FlashcardResponse])
def list_flashcards(workspace_id: int, db_path: Path = Depends(get_db_path)) -> list[dict]:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        rows = connection.execute(
            "SELECT f.id, f.workspace_id, f.question, f.answer, f.source_page, f.source_doc, f.created_at, "
            "(SELECT result FROM flashcard_reviews WHERE flashcard_id = f.id ORDER BY id DESC LIMIT 1) AS last_review "
            "FROM flashcards f WHERE f.workspace_id = ? ORDER BY f.id",
            (workspace_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@router.post("/{workspace_id}/flashcards/generate", response_model=list[FlashcardResponse])
def generate_workspace_flashcards(workspace_id: int, db_path: Path = Depends(get_db_path)) -> list[dict]:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        documents = [dict(row) for row in connection.execute(
            "SELECT filename, content FROM documents WHERE workspace_id = ? ORDER BY id", (workspace_id,)
        ).fetchall()]
    if not documents:
        raise HTTPException(status_code=422, detail="Upload at least one document before generating flashcards")
    try:
        cards = generate_flashcards(documents)
    except RuntimeError as exc:
        status_code = 503 if "GROQ_API_KEY" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Flashcard generation failed") from exc
    filenames = {document["filename"] for document in documents}
    validated = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        question, answer = card.get("question"), card.get("answer")
        source_doc = card.get("source_doc")
        source_page = card.get("source_page")
        if not isinstance(question, str) or not question.strip() or not isinstance(answer, str) or not answer.strip():
            continue
        if source_doc not in filenames:
            source_doc = None
        if not isinstance(source_page, int) or isinstance(source_page, bool) or source_page < 1:
            source_page = None
        validated.append((question.strip(), answer.strip(), source_page, source_doc))
    if not validated:
        raise HTTPException(status_code=502, detail="The model did not return any usable flashcards")
    with get_connection(db_path) as connection:
        connection.execute("DELETE FROM flashcards WHERE workspace_id = ?", (workspace_id,))
        for question, answer, source_page, source_doc in validated:
            connection.execute(
                "INSERT INTO flashcards (workspace_id, question, answer, source_page, source_doc, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (workspace_id, question, answer, source_page, source_doc, utc_now()),
            )
        rows = connection.execute(
            "SELECT id, workspace_id, question, answer, source_page, source_doc, created_at, NULL AS last_review "
            "FROM flashcards WHERE workspace_id = ? ORDER BY id", (workspace_id,)
        ).fetchall()
    return [dict(row) for row in rows]


@router.post("/{workspace_id}/flashcards/{card_id}/review", response_model=FlashcardResponse)
def review_flashcard(
    workspace_id: int, card_id: int, payload: FlashcardReviewRequest, db_path: Path = Depends(get_db_path)
) -> dict:
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT id, workspace_id, question, answer, source_page, source_doc, created_at "
            "FROM flashcards WHERE id = ? AND workspace_id = ?", (card_id, workspace_id)
        ).fetchone()
        if row is None:
            _workspace = connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone()
            if _workspace is None:
                raise HTTPException(status_code=404, detail="Workspace not found")
            raise HTTPException(status_code=404, detail="Flashcard not found")
        connection.execute(
            "INSERT INTO flashcard_reviews (flashcard_id, result, reviewed_at) VALUES (?, ?, ?)",
            (card_id, payload.result, utc_now()),
        )
        return {**dict(row), "last_review": payload.result}
