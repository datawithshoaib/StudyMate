from io import BytesIO
from pathlib import Path

import pytest
from docx import Document as DocxDocument
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app = create_app(db_path=tmp_path / "studymate.db", chroma_path=tmp_path / "chroma")
    with TestClient(app) as test_client:
        yield test_client


def section(prefix: str, word_count: int) -> str:
    return " ".join(f"{prefix}{index}" for index in range(word_count))


def pdf_bytes(pages: list[str]) -> bytes:
    buffer = BytesIO()
    pdf_canvas = canvas.Canvas(buffer)
    for page_text in pages:
        text_object = pdf_canvas.beginText(40, 750)
        text_object.setFont("Helvetica", 9)
        words = page_text.split()
        for start in range(0, len(words), 8):
            text_object.textLine(" ".join(words[start : start + 8]))
        pdf_canvas.drawText(text_object)
        pdf_canvas.showPage()
    pdf_canvas.save()
    return buffer.getvalue()


def docx_bytes(paragraphs: list[str]) -> bytes:
    document = DocxDocument()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def stored_chunks(client: TestClient, workspace_id: int) -> list[tuple[str, str, dict]]:
    collection = client.app.state.chroma_client.get_collection(f"workspace_{workspace_id}")
    stored = collection.get(include=["documents", "metadatas"])
    return sorted(
        zip(stored["ids"], stored["documents"], stored["metadatas"]),
        key=lambda item: item[0],
    )


def test_uploaded_text_is_extracted_chunked_embedded_and_stored(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]
    text = f"{section('alpha', 300)}\n\n{section('beta', 300)}"

    response = client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[("files", ("notes.txt", text.encode("utf-8"), "text/plain"))],
    )

    assert response.status_code == 201
    created = response.json()
    assert len(created) == 1
    assert created[0]["workspace_id"] == workspace_id
    assert created[0]["filename"] == "notes.txt"
    assert created[0]["uploaded_at"]
    assert created[0]["chunk_count"] == 3

    chunks = stored_chunks(client, workspace_id)
    assert len(chunks) == 3
    assert [metadata["page"] for _, _, metadata in chunks] == [1, 1, 2]
    assert all(metadata["document_id"] == created[0]["id"] for _, _, metadata in chunks)
    assert chunks[0][1].split()[-20:] == chunks[1][1].split()[:20]


def test_uploaded_pdf_tracks_page_numbers(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    pages = [section("pageone", 300), section("pagetwo", 300)]

    response = client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[("files", ("lecture.pdf", pdf_bytes(pages), "application/pdf"))],
    )

    assert response.status_code == 201
    assert response.json()[0]["chunk_count"] == 3
    chunks = stored_chunks(client, workspace_id)
    assert [metadata["page"] for _, _, metadata in chunks] == [1, 1, 2]
    assert any("pageone" in text for _, text, _ in chunks)
    assert any("pagetwo" in text for _, text, _ in chunks)


def test_uploaded_docx_uses_sequential_section_numbers(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    paragraphs = [section("first", 300), section("second", 300)]

    response = client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[
            (
                "files",
                (
                    "notes.docx",
                    docx_bytes(paragraphs),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ),
            )
        ],
    )

    assert response.status_code == 201
    assert response.json()[0]["chunk_count"] == 3
    chunks = stored_chunks(client, workspace_id)
    assert [metadata["page"] for _, _, metadata in chunks] == [1, 1, 2]


def test_uploaded_markdown_uses_sequential_section_numbers(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]
    text = f"# {section('alpha', 300)}\n\n## {section('beta', 300)}"

    response = client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[("files", ("notes.md", text.encode("utf-8"), "text/markdown"))],
    )

    assert response.status_code == 201
    assert response.json()[0]["chunk_count"] == 3
    chunks = stored_chunks(client, workspace_id)
    assert [metadata["page"] for _, _, metadata in chunks] == [1, 1, 2]


def test_list_documents_returns_workspace_documents(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]
    other_id = client.post("/api/workspaces", json={"name": "Biology"}).json()["id"]
    client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[
            ("files", ("first.txt", b"first document", "text/plain")),
            ("files", ("second.md", b"# second document", "text/markdown")),
        ],
    )

    response = client.get(f"/api/workspaces/{workspace_id}/documents")

    assert response.status_code == 200
    documents = response.json()
    assert [document["filename"] for document in documents] == ["first.txt", "second.md"]
    assert all(document["workspace_id"] == workspace_id for document in documents)
    assert all(document["uploaded_at"] for document in documents)
    assert all(document["chunk_count"] == 1 for document in documents)
    assert client.get(f"/api/workspaces/{other_id}/documents").json() == []


def test_delete_document_removes_its_chunks_from_vector_store(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]
    created = client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[
            ("files", ("first.txt", b"first document", "text/plain")),
            ("files", ("second.txt", b"second document", "text/plain")),
        ],
    ).json()
    first_id, second_id = created[0]["id"], created[1]["id"]
    collection = client.app.state.chroma_client.get_collection(f"workspace_{workspace_id}")
    assert len(stored_chunks(client, workspace_id)) == 2

    response = client.delete(f"/api/workspaces/{workspace_id}/documents/{first_id}")

    assert response.status_code == 204
    assert [document["id"] for document in client.get(f"/api/workspaces/{workspace_id}/documents").json()] == [second_id]
    assert collection.get(where={"document_id": first_id})["ids"] == []
    assert [metadata["document_id"] for _, _, metadata in stored_chunks(client, workspace_id)] == [second_id]


def test_delete_missing_document_returns_404(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]

    response = client.delete(f"/api/workspaces/{workspace_id}/documents/999")

    assert response.status_code == 404


def test_upload_rejects_unsupported_document_type(client: TestClient) -> None:
    workspace_id = client.post("/api/workspaces", json={"name": "CS101"}).json()["id"]

    response = client.post(
        f"/api/workspaces/{workspace_id}/documents",
        files=[("files", ("image.png", b"not a document", "image/png"))],
    )

    assert response.status_code == 400
    assert client.get(f"/api/workspaces/{workspace_id}/documents").json() == []


def test_upload_to_missing_workspace_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/workspaces/999/documents",
        files=[("files", ("notes.txt", b"text", "text/plain"))],
    )

    assert response.status_code == 404
