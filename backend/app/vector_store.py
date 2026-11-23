from pathlib import Path

import chromadb
from chromadb.api import ClientAPI
from chromadb.config import Settings
from chromadb.errors import NotFoundError


def create_chroma_client(persist_directory: Path) -> ClientAPI:
    persist_directory.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(persist_directory),
        settings=Settings(anonymized_telemetry=False),
    )


def workspace_collection_name(workspace_id: int) -> str:
    return f"workspace_{workspace_id}"


def delete_workspace_collection(client: ClientAPI, workspace_id: int) -> None:
    try:
        client.delete_collection(workspace_collection_name(workspace_id))
    except NotFoundError:
        pass
