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


def create_workspace_and_document(client: TestClient) -> tuple[int, int]:
    workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    with get_connection(client.app.state.db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO documents (workspace_id, filename, content, uploaded_at) "
            "VALUES (?, ?, ?, ?)",
            (workspace_id, "cell-biology.txt", "Cells contain a nucleus and mitochondria.", "2026-01-01T00:00:00Z"),
        )
    return workspace_id, cursor.lastrowid


def test_generate_summary_uses_document_content_and_returns_summary(
    client: TestClient, monkeypatch
) -> None:
    workspace_id, document_id = create_workspace_and_document(client)
    calls: list[tuple[str, str, str | None]] = []

    def fake_generate(name: str, content: str, perspective: str | None = None) -> str:
        calls.append((name, content, perspective))
        return "## Key concepts\n- Cells are the basic unit of life.\n\n## Definitions\n- Nucleus: stores DNA.\n\n## Important points\n- Mitochondria produce energy."

    monkeypatch.setattr("app.routers.summaries.generate_summary_content", fake_generate)

    response = client.post(
        f"/api/workspaces/{workspace_id}/summaries/generate",
        json={"document_id": document_id, "perspective": "exam revision"},
    )

    assert response.status_code == 200
    summary = response.json()
    assert summary["workspace_id"] == workspace_id
    assert summary["document_id"] == document_id
    assert "## Key concepts" in summary["content"]
    assert calls == [("cell-biology.txt", "Cells contain a nucleus and mitochondria.", "exam revision")]


def test_list_summaries_is_scoped_to_workspace(client: TestClient, monkeypatch) -> None:
    workspace_id, document_id = create_workspace_and_document(client)
    other_workspace_id, _ = create_workspace_and_document(client)
    monkeypatch.setattr(
        "app.routers.summaries.generate_summary_content", lambda *args: "# Study guide"
    )
    client.post(
        f"/api/workspaces/{workspace_id}/summaries/generate", json={"document_id": document_id}
    )

    response = client.get(f"/api/workspaces/{workspace_id}/summaries")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["document_id"] == document_id
    assert client.get(f"/api/workspaces/{other_workspace_id}/summaries").json() == []


def test_regenerating_replaces_previous_summary(client: TestClient, monkeypatch) -> None:
    workspace_id, document_id = create_workspace_and_document(client)
    generated = iter(["# First perspective", "# Second perspective"])
    monkeypatch.setattr(
        "app.routers.summaries.generate_summary_content", lambda *args: next(generated)
    )
    endpoint = f"/api/workspaces/{workspace_id}/summaries/generate"

    first = client.post(endpoint, json={"document_id": document_id}).json()
    second = client.post(endpoint, json={"document_id": document_id, "perspective": "beginner"}).json()
    listed = client.get(f"/api/workspaces/{workspace_id}/summaries").json()

    assert second["id"] != first["id"]
    assert second["content"] == "# Second perspective"
    assert len(listed) == 1
    assert listed[0]["id"] == second["id"]


def test_generate_summary_rejects_document_from_another_workspace(client: TestClient) -> None:
    _workspace_id, document_id = create_workspace_and_document(client)
    other_workspace_id = client.post("/api/workspaces", json={"name": "Physics"}).json()["id"]

    response = client.post(
        f"/api/workspaces/{other_workspace_id}/summaries/generate",
        json={"document_id": document_id},
    )

    assert response.status_code == 404
