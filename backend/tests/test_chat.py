import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.database import get_connection, utc_now
from app.main import create_app
from app.routers import chat as chat_router


class FakeStream:
    def __aiter__(self):
        async def tokens():
            for token in ("Photosynthesis converts light energy ", "into chemical energy [1]."):
                yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=token))])
        return tokens()


class FakeCompletions:
    async def create(self, **kwargs):
        assert kwargs["model"] == "openai/gpt-oss-120b"
        assert kwargs["stream"] is True
        return FakeStream()


class FakeClient:
    chat = SimpleNamespace(completions=FakeCompletions())


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(chat_router, "embed_texts", lambda texts: [[0.0, 0.0, 0.0] for _ in texts])
    app = create_app(db_path=tmp_path / "studymate.db", chroma_path=tmp_path / "chroma")
    with TestClient(app) as test_client:
        test_client.app.state.chat_client = FakeClient()
        yield test_client


def add_sources(client: TestClient, workspace_id: int) -> int:
    collection = client.app.state.chroma_client.get_or_create_collection(f"workspace_{workspace_id}")
    collection.add(
        ids=["first", "second"],
        documents=["Plants use sunlight to make glucose.", "Mitochondria produce cellular energy."],
        embeddings=[[0.0, 0.0, 0.0], [0.1, 0.1, 0.1]],
        metadatas=[
            {"document_id": 11, "filename": "biology.pdf", "page": 4},
            {"document_id": 12, "filename": "cells.pdf", "page": 7},
        ],
    )
    return 11


def test_chat_streams_tokens_and_citation_metadata(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    add_sources(client, workspace_id)

    response = client.post(f"/api/workspaces/{workspace_id}/chat", json={"message": "What is photosynthesis?"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
    assert [event["type"] for event in events] == ["token", "token", "citation", "done"]
    assert "".join(event["data"] for event in events if event["type"] == "token").endswith("[1].")
    citation = events[2]["data"]
    assert citation == {
        "number": 1,
        "document_id": 11,
        "filename": "biology.pdf",
        "page": 4,
        "snippet": "Plants use sunlight to make glucose.",
    }


def test_document_scope_filters_retrieval(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    with get_connection(client.app.state.db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO documents (workspace_id, filename, content, uploaded_at) VALUES (?, ?, ?, ?)",
            (workspace_id, "biology.pdf", "source text", utc_now()),
        )
        document_id = cursor.lastrowid
    collection = client.app.state.chroma_client.get_or_create_collection(f"workspace_{workspace_id}")
    collection.add(
        ids=["scoped"], documents=["Photosynthesis details."], embeddings=[[0.0, 0.0, 0.0]],
        metadatas=[{"document_id": document_id, "filename": "biology.pdf", "page": 2}],
    )
    source_calls = []
    original_sources = chat_router._sources

    def capture_sources(request, requested_workspace, query, requested_document):
        source_calls.append(requested_document)
        return original_sources(request, requested_workspace, query, requested_document)

    monkeypatch.setattr(chat_router, "_sources", capture_sources)
    response = client.post(
        f"/api/workspaces/{workspace_id}/chat",
        json={"message": "Explain this", "document_id": document_id},
    )
    assert response.status_code == 200
    assert source_calls == [document_id]
    events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
    citation = next(event["data"] for event in events if event["type"] == "citation")
    assert citation["document_id"] == document_id


def test_message_history_can_be_listed_and_cleared(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    add_sources(client, workspace_id)
    client.post(f"/api/workspaces/{workspace_id}/chat", json={"message": "What is photosynthesis?"})

    history = client.get(f"/api/workspaces/{workspace_id}/messages")
    assert history.status_code == 200
    assert [message["role"] for message in history.json()] == ["user", "assistant"]
    assert history.json()[1]["citations"][0]["page"] == 4

    cleared = client.delete(f"/api/workspaces/{workspace_id}/messages")
    assert cleared.status_code == 204
    assert client.get(f"/api/workspaces/{workspace_id}/messages").json() == []

