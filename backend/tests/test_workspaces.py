from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.database import get_connection, utc_now
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app = create_app(db_path=tmp_path / "studymate.db", chroma_path=tmp_path / "chroma")
    with TestClient(app) as test_client:
        yield test_client


def test_list_workspaces_returns_empty_list(client: TestClient) -> None:
    response = client.get("/api/workspaces")

    assert response.status_code == 200
    assert response.json() == []


def test_create_workspace(client: TestClient) -> None:
    response = client.post("/api/workspaces", json={"name": "CS101"})

    assert response.status_code == 201
    created = response.json()
    assert created["id"] > 0
    assert created["name"] == "CS101"
    assert created["created_at"]
    assert created["updated_at"]

    listed = client.get("/api/workspaces")
    assert [workspace["name"] for workspace in listed.json()] == ["CS101"]


def test_rename_workspace(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]

    response = client.put(f"/api/workspaces/{workspace_id}", json={"name": "CS102"})

    assert response.status_code == 200
    assert response.json()["name"] == "CS102"
    assert [w["name"] for w in client.get("/api/workspaces").json()] == ["CS102"]


def test_rename_missing_workspace_returns_404(client: TestClient) -> None:
    response = client.put("/api/workspaces/999", json={"name": "CS102"})

    assert response.status_code == 404


def test_delete_workspace(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]

    response = client.delete(f"/api/workspaces/{workspace_id}")

    assert response.status_code == 204
    assert client.get("/api/workspaces").json() == []


def test_delete_missing_workspace_returns_404(client: TestClient) -> None:
    response = client.delete("/api/workspaces/999")

    assert response.status_code == 404


def test_delete_workspace_cascades_to_related_data(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]
    now = utc_now()
    with get_connection(client.app.state.db_path) as connection:
        connection.execute(
            "INSERT INTO documents (workspace_id, filename, content, uploaded_at) "
            "VALUES (?, ?, ?, ?)",
            (workspace_id, "notes.pdf", "text", now),
        )
        document_id = connection.execute(
            "SELECT id FROM documents WHERE workspace_id = ?", (workspace_id,)
        ).fetchone()["id"]
        connection.execute(
            "INSERT INTO messages (workspace_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?)",
            (workspace_id, "user", "question", now),
        )
        connection.execute(
            "INSERT INTO flashcards (workspace_id, question, answer, created_at) "
            "VALUES (?, ?, ?, ?)",
            (workspace_id, "question", "answer", now),
        )
        flashcard_id = connection.execute(
            "SELECT id FROM flashcards WHERE workspace_id = ?", (workspace_id,)
        ).fetchone()["id"]
        connection.execute(
            "INSERT INTO flashcard_reviews (flashcard_id, result, reviewed_at) "
            "VALUES (?, ?, ?)",
            (flashcard_id, "got_it", now),
        )
        connection.execute(
            "INSERT INTO quizzes (workspace_id, difficulty, created_at) VALUES (?, ?, ?)",
            (workspace_id, "Medium", now),
        )
        quiz_id = connection.execute(
            "SELECT id FROM quizzes WHERE workspace_id = ?", (workspace_id,)
        ).fetchone()["id"]
        connection.execute(
            "INSERT INTO quiz_questions (quiz_id, question, options, correct_option) "
            "VALUES (?, ?, ?, ?)",
            (quiz_id, "question", '["a","b"]', 0),
        )
        connection.execute(
            "INSERT INTO summaries (workspace_id, document_id, content, created_at) "
            "VALUES (?, ?, ?, ?)",
            (workspace_id, document_id, "# Notes", now),
        )

    response = client.delete(f"/api/workspaces/{workspace_id}")

    assert response.status_code == 204
    tables = (
        "documents",
        "messages",
        "flashcards",
        "flashcard_reviews",
        "quizzes",
        "quiz_questions",
        "summaries",
    )
    with get_connection(client.app.state.db_path) as connection:
        for table in tables:
            assert connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0


def test_create_workspace_rejects_blank_name(client: TestClient) -> None:
    response = client.post("/api/workspaces", json={"name": "   "})

    assert response.status_code == 422
    assert client.get("/api/workspaces").json() == []
