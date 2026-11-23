from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path):
    app = create_app(db_path=tmp_path / "studymate.db", chroma_path=tmp_path / "chroma")
    with TestClient(app) as test_client:
        yield test_client


def _workspace_with_document(client: TestClient) -> int:
    workspace_id = client.post("/api/workspaces", json={"name": "Chemistry"}).json()["id"]
    with get_connection(client.app.state.db_path) as connection:
        connection.execute(
            "INSERT INTO documents (workspace_id, filename, content, uploaded_at) VALUES (?, ?, ?, ?)",
            (workspace_id, "atoms.txt", "Atoms contain protons, neutrons, and electrons.", "2026-01-01T00:00:00Z"),
        )
    return workspace_id


def _questions(_documents: list[dict], count: int, difficulty: str) -> list[dict]:
    return [
        {
            "question": f"Which particle has positive charge? {index}",
            "options": ["Proton", "Neutron", "Electron", "Photon"],
            "correct_option": 0,
            "explanation": "Protons carry a positive charge.",
            "source_page": 1,
            "source_doc": "atoms.txt",
        }
        for index in range(count)
    ]


def test_generate_list_get_and_score_quiz(client: TestClient, monkeypatch) -> None:
    workspace_id = _workspace_with_document(client)
    calls = []

    def generate(documents, count, difficulty):
        calls.append((documents, count, difficulty))
        return _questions(documents, count, difficulty)

    monkeypatch.setattr("app.routers.quizzes.generate_quiz_questions", generate)
    response = client.post(
        f"/api/workspaces/{workspace_id}/quizzes/generate",
        json={"count": 2, "difficulty": "hard"},
    )
    assert response.status_code == 200
    quiz = response.json()
    assert quiz["difficulty"] == "Hard"
    assert quiz["question_count"] == 2
    assert quiz["questions"][0]["correct_option"] is None
    assert calls[0][1:] == (2, "Hard")

    listed = client.get(f"/api/workspaces/{workspace_id}/quizzes")
    fetched = client.get(f"/api/workspaces/{workspace_id}/quizzes/{quiz['id']}")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert fetched.json()["questions"][0]["explanation"] is None

    result = client.post(
        f"/api/workspaces/{workspace_id}/quizzes/{quiz['id']}/submit",
        json={"answers": {str(quiz["questions"][0]["id"]): 0, str(quiz["questions"][1]["id"]): 2}},
    )
    assert result.status_code == 200
    scored = result.json()
    assert scored["submitted"] is True
    assert scored["score"] == 1
    assert scored["questions"][0]["is_correct"] is True
    assert scored["questions"][0]["correct_option"] == 0
    assert scored["questions"][0]["explanation"] == "Protons carry a positive charge."
    assert scored["questions"][0]["source_doc"] == "atoms.txt"
    assert scored["questions"][0]["source_page"] == 1
    reopened = client.get(f"/api/workspaces/{workspace_id}/quizzes/{quiz['id']}").json()
    assert reopened["submitted"] is True
    assert reopened["score"] == 1
    assert reopened["questions"][0]["is_correct"] is True


def test_quiz_generation_requires_documents_and_valid_configuration(client: TestClient, monkeypatch) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "Empty"}).json()["id"]
    assert client.post(f"/api/workspaces/{workspace_id}/quizzes/generate", json={}).status_code == 400
    workspace_id = _workspace_with_document(client)
    invalid_count = client.post(f"/api/workspaces/{workspace_id}/quizzes/generate", json={"count": 0})
    invalid_difficulty = client.post(f"/api/workspaces/{workspace_id}/quizzes/generate", json={"difficulty": "expert"})
    assert invalid_count.status_code == 422
    assert invalid_difficulty.status_code == 422


def test_submit_requires_an_answer_for_every_question(client: TestClient, monkeypatch) -> None:
    workspace_id = _workspace_with_document(client)
    monkeypatch.setattr("app.routers.quizzes.generate_quiz_questions", _questions)
    quiz = client.post(f"/api/workspaces/{workspace_id}/quizzes/generate", json={"count": 2}).json()
    response = client.post(
        f"/api/workspaces/{workspace_id}/quizzes/{quiz['id']}/submit",
        json={"answers": {str(quiz["questions"][0]["id"]): 0}},
    )
    assert response.status_code == 422


def test_quiz_routes_are_workspace_scoped(client: TestClient) -> None:
    workspace_id = _workspace_with_document(client)
    other_id = client.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    response = client.get(f"/api/workspaces/{other_id}/quizzes/1")
    assert response.status_code == 404
    assert client.get(f"/api/workspaces/{workspace_id}/quizzes").json() == []
