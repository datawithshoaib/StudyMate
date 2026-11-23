from pydantic import BaseModel, field_validator


class WorkspaceName(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Workspace name cannot be empty")
        return value


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: int
    workspace_id: int
    filename: str
    uploaded_at: str
    chunk_count: int

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    message: str
    document_id: int | None = None


class Citation(BaseModel):
    number: int
    document_id: int
    filename: str
    page: int
    snippet: str


class MessageResponse(BaseModel):
    id: int
    workspace_id: int
    role: str
    content: str
    citations: list[Citation]
    created_at: str

class SummaryGenerateRequest(BaseModel):
    document_id: int
    perspective: str | None = None


class SummaryResponse(BaseModel):
    id: int
    workspace_id: int
    document_id: int
    content: str
    created_at: str

    model_config = {"from_attributes": True}
