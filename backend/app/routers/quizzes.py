import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request

from app.database import get_connection, utc_now
from app.routers.documents import get_db_path
from app.schemas import (
    QuizGenerateRequest,
    QuizQuestionResponse,
    QuizResponse,
    QuizSubmitRequest,
)
from app.quiz_generation import generate_quiz_questions
from app.vector_store import workspace_collection_name

router = APIRouter(prefix="/api/workspaces", tags=["quizzes"])


def _quiz_response(connection, workspace_id: int, quiz_row, include_answers: bool = False) -> QuizResponse:
    submission = connection.execute(
        "SELECT answers, score FROM quiz_submissions WHERE quiz_id = ?", (quiz_row["id"],)
    ).fetchone()
    submitted_answers = json.loads(submission["answers"]) if submission else {}
    rows = connection.execute(
        "SELECT id, question, options, correct_option, explanation, source_page, source_doc "
        "FROM quiz_questions WHERE quiz_id = ? ORDER BY id", (quiz_row["id"],)
    ).fetchall()
    questions = []
    for row in rows:
        values = dict(row)
        values["options"] = json.loads(values["options"])
        if not include_answers and not submission:
            values["correct_option"] = None
            values["explanation"] = None
        if submission:
            selected = submitted_answers.get(str(values["id"]))
            values["selected_option"] = selected
            values["is_correct"] = selected == values["correct_option"]
        questions.append(QuizQuestionResponse(**values))
    return QuizResponse(
        id=quiz_row["id"], workspace_id=workspace_id, difficulty=quiz_row["difficulty"],
        created_at=quiz_row["created_at"], question_count=len(questions), questions=questions,
        score=submission["score"] if submission else None, submitted=submission is not None,
    )


@router.post("/{workspace_id}/quizzes/generate", response_model=QuizResponse)
def generate_quiz(workspace_id: int, payload: QuizGenerateRequest, request: Request,
                  db_path: Path = Depends(get_db_path)) -> QuizResponse:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        documents = connection.execute(
            "SELECT id, filename, content FROM documents WHERE workspace_id = ? ORDER BY id", (workspace_id,)
        ).fetchall()
    if not documents:
        raise HTTPException(status_code=400, detail="Upload at least one document before generating a quiz")

    sources: list[dict[str, str]] = []
    try:
        collection = request.app.state.chroma_client.get_collection(workspace_collection_name(workspace_id))
        chunks = collection.get(include=["documents", "metadatas"])
        documents_by_id = {row["id"]: row["filename"] for row in documents}
        combined: dict[tuple[str, int], list[str]] = {}
        for content, metadata in zip(chunks.get("documents") or [], chunks.get("metadatas") or []):
            filename = str(metadata.get("filename") or documents_by_id.get(metadata.get("document_id"), ""))
            if filename:
                combined.setdefault((filename, int(metadata.get("page", 1))), []).append(content)
        sources = [
            {"filename": filename, "page": page, "content": "\n".join(texts)}
            for (filename, page), texts in combined.items()
        ]
    except Exception:
        sources = []
    if not sources:
        sources = [{"filename": row["filename"], "page": 1, "content": row["content"]} for row in documents]
    try:
        questions = generate_quiz_questions(sources, payload.count, payload.difficulty)
    except RuntimeError as exc:
        status_code = 503 if "GROQ_API_KEY" in str(exc) else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Quiz generation failed") from exc

    created_at = utc_now()
    with get_connection(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO quizzes (workspace_id, difficulty, created_at) VALUES (?, ?, ?)",
            (workspace_id, payload.difficulty, created_at),
        )
        quiz_id = cursor.lastrowid
        for question in questions:
            connection.execute(
                "INSERT INTO quiz_questions (quiz_id, question, options, correct_option, explanation, source_page, source_doc) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (quiz_id, question["question"], json.dumps(question["options"]), question["correct_option"],
                 question["explanation"], question["source_page"], question["source_doc"]),
            )
        quiz = connection.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        return _quiz_response(connection, workspace_id, quiz)


@router.get("/{workspace_id}/quizzes", response_model=list[QuizResponse])
def list_quizzes(workspace_id: int, db_path: Path = Depends(get_db_path)) -> list[QuizResponse]:
    with get_connection(db_path) as connection:
        if connection.execute("SELECT id FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        rows = connection.execute("SELECT * FROM quizzes WHERE workspace_id = ? ORDER BY id DESC", (workspace_id,)).fetchall()
        return [_quiz_response(connection, workspace_id, row) for row in rows]


@router.get("/{workspace_id}/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(workspace_id: int, quiz_id: int, db_path: Path = Depends(get_db_path)) -> QuizResponse:
    with get_connection(db_path) as connection:
        quiz = connection.execute("SELECT * FROM quizzes WHERE id = ? AND workspace_id = ?", (quiz_id, workspace_id)).fetchone()
        if quiz is None:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return _quiz_response(connection, workspace_id, quiz)


@router.post("/{workspace_id}/quizzes/{quiz_id}/submit", response_model=QuizResponse)
def submit_quiz(workspace_id: int, quiz_id: int, payload: QuizSubmitRequest,
                db_path: Path = Depends(get_db_path)) -> QuizResponse:
    with get_connection(db_path) as connection:
        quiz = connection.execute("SELECT * FROM quizzes WHERE id = ? AND workspace_id = ?", (quiz_id, workspace_id)).fetchone()
        if quiz is None:
            raise HTTPException(status_code=404, detail="Quiz not found")
        rows = connection.execute(
            "SELECT id, question, options, correct_option, explanation, source_page, source_doc "
            "FROM quiz_questions WHERE quiz_id = ? ORDER BY id", (quiz_id,)
        ).fetchall()
        question_ids = {row["id"] for row in rows}
        if set(payload.answers) != question_ids:
            raise HTTPException(status_code=422, detail="Submit one answer for every quiz question")
        if any(answer < 0 or answer >= len(json.loads(row["options"])) for row in rows for answer in [payload.answers[row["id"]]]):
            raise HTTPException(status_code=422, detail="Answer option is out of range")
        questions = [QuizQuestionResponse(
            id=row["id"], question=row["question"], options=json.loads(row["options"]),
            correct_option=row["correct_option"], explanation=row["explanation"],
            source_page=row["source_page"], source_doc=row["source_doc"],
            selected_option=payload.answers[row["id"]], is_correct=payload.answers[row["id"]] == row["correct_option"],
        ) for row in rows]
        score = sum(question.is_correct is True for question in questions)
        connection.execute(
            "INSERT INTO quiz_submissions (quiz_id, answers, score, submitted_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(quiz_id) DO UPDATE SET answers = excluded.answers, score = excluded.score, "
            "submitted_at = excluded.submitted_at",
            (quiz_id, json.dumps({str(key): value for key, value in payload.answers.items()}), score, utc_now()),
        )
        return QuizResponse(
            id=quiz_id, workspace_id=workspace_id, difficulty=quiz["difficulty"], created_at=quiz["created_at"],
            question_count=len(questions), score=score, submitted=True, questions=questions,
        )
