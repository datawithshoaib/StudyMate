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


class FlashcardResponse(BaseModel):
    id: int
    workspace_id: int
    question: str
    answer: str
    source_page: int | None = None
    source_doc: str | None = None
    created_at: str
    last_review: str | None = None


class FlashcardReviewRequest(BaseModel):
    result: str

    @field_validator("result")
    @classmethod
    def result_must_be_valid(cls, value: str) -> str:
        if value not in {"got_it", "missed_it"}:
            raise ValueError("Result must be got_it or missed_it")
        return value


class QuizGenerateRequest(BaseModel):
    count: int = 10
    difficulty: str = "Medium"

    @field_validator("count")
    @classmethod
    def count_in_range(cls, value: int) -> int:
        if not 1 <= value <= 50:
            raise ValueError("Question count must be between 1 and 50")
        return value

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, value: str) -> str:
        normalized = value.strip().capitalize()
        if normalized not in {"Easy", "Medium", "Hard"}:
            raise ValueError("Difficulty must be Easy, Medium, or Hard")
        return normalized


class QuizSubmitRequest(BaseModel):
    answers: dict[int, int]


class QuizQuestionResponse(BaseModel):
    id: int
    question: str
    options: list[str]
    correct_option: int | None = None
    explanation: str | None = None
    source_page: int | None = None
    source_doc: str | None = None
    selected_option: int | None = None
    is_correct: bool | None = None


class QuizResponse(BaseModel):
    id: int
    workspace_id: int
    difficulty: str
    created_at: str
    question_count: int
    score: int | None = None
    submitted: bool = False
    questions: list[QuizQuestionResponse] = []
