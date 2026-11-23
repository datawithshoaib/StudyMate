from pathlib import Path

from fastapi.testclient import TestClient

from app.database import get_connection
from app.main import create_app


def test_flashcard_generation_listing_review_and_regeneration(tmp_path: Path, monkeypatch) -> None:
    app = create_app(db_path=tmp_path / "studymate.db", chroma_path=tmp_path / "chroma")
    with TestClient(app) as client:
        workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
        with get_connection(app.state.db_path) as connection:
            connection.execute(
                "INSERT INTO documents (workspace_id, filename, content, uploaded_at) VALUES (?, ?, ?, ?)",
                (workspace_id, "cells.pdf", "Mitochondria produce ATP.", "2026-01-01T00:00:00Z"),
            )
        responses = iter([
            [{"question": "What do mitochondria produce?", "answer": "ATP", "source_page": 2, "source_doc": "cells.pdf"}],
            [{"question": "What is ATP?", "answer": "Cellular energy currency", "source_page": 3, "source_doc": "cells.pdf"}],
        ])
        calls = []

        def fake_generate(documents):
            calls.append(documents)
            return next(responses)

        monkeypatch.setattr("app.routers.flashcards.generate_flashcards", fake_generate)
        endpoint = f"/api/workspaces/{workspace_id}/flashcards"
        first = client.post(f"{endpoint}/generate")
        assert first.status_code == 200
        card = first.json()[0]
        assert (card["source_doc"], card["source_page"]) == ("cells.pdf", 2)
        assert client.get(endpoint).json() == first.json()

        reviewed = client.post(f"{endpoint}/{card['id']}/review", json={"result": "got_it"})
        assert reviewed.status_code == 200
        assert reviewed.json()["last_review"] == "got_it"
        assert client.post(f"{endpoint}/{card['id']}/review", json={"result": "unknown"}).status_code == 422

        second = client.post(f"{endpoint}/generate")
        assert second.status_code == 200
        assert second.json()[0]["question"] == "What is ATP?"
        assert second.json()[0]["id"] != card["id"]
        assert client.get(endpoint).json() == second.json()
        assert calls == [[{"filename": "cells.pdf", "content": "Mitochondria produce ATP."}]] * 2


def test_flashcard_generation_requires_documents(tmp_path: Path) -> None:
    app = create_app(db_path=tmp_path / "studymate.db", chroma_path=tmp_path / "chroma")
    with TestClient(app) as client:
        workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
        response = client.post(f"/api/workspaces/{workspace_id}/flashcards/generate")
        assert response.status_code == 422
