from pathlib import Path

import chromadb
from chromadb.api import ClientAPI
from chromadb.config import Settings
from chromadb.errors import NotFoundError

from app.documents import Chunk


def create_chroma_client(persist_directory: Path) -> ClientAPI:
    persist_directory.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(persist_directory),
        settings=Settings(anonymized_telemetry=False),
    )


def workspace_collection_name(workspace_id: int) -> str:
    return f"workspace_{workspace_id}"


def get_workspace_collection(client: ClientAPI, workspace_id: int):
    return client.get_or_create_collection(name=workspace_collection_name(workspace_id))


def store_chunks(
    collection,
    document_id: int,
    filename: str,
    chunks: list[Chunk],
    embeddings: list[list[float]],
) -> None:
    if not chunks:
        return
    collection.add(
        ids=[f"doc_{document_id}_chunk_{index}" for index in range(len(chunks))],
        documents=[chunk.text for chunk in chunks],
        embeddings=embeddings,
        metadatas=[
            {"document_id": document_id, "filename": filename, "page": chunk.page}
            for chunk in chunks
        ],
    )


def count_document_chunks(client: ClientAPI, workspace_id: int, document_id: int) -> int:
    try:
        collection = client.get_collection(workspace_collection_name(workspace_id))
    except NotFoundError:
        return 0
    return len(collection.get(where={"document_id": document_id})["ids"])


def delete_document_chunks(client: ClientAPI, workspace_id: int, document_id: int) -> None:
    try:
        collection = client.get_collection(workspace_collection_name(workspace_id))
    except NotFoundError:
        return
    collection.delete(where={"document_id": document_id})


def delete_workspace_collection(client: ClientAPI, workspace_id: int) -> None:
    try:
        client.delete_collection(workspace_collection_name(workspace_id))
    except NotFoundError:
        pass
