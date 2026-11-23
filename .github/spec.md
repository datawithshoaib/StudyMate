## Problem Statement

StudyMate is currently a bare-bones single-PDF Q&A chatbot. A student uploads one PDF, asks questions, and gets short answers from a vanilla JS/Jinja2 frontend served by FastAPI. There is no document organization, no page-level citations, no active-learning tools (flashcards, quizzes, summaries), no streaming, and no modern UI. Students preparing for exams need more than a chatbot — they need a study companion that helps them organize materials by subject, verify answers against source pages, and actively test their understanding.

## Solution

Rebuild StudyMate as a full-featured study workspace application:

- **Workspace-based organization** — subjects/courses with multiple documents each
- **Multi-format uploads** — PDF, DOCX, TXT, Markdown
- **Streaming AI chat** with inline citations and document-scope filtering
- **On-demand flashcards** with flip-and-rate review
- **On-demand practice quizzes** with configurable count, difficulty, and scored results
- **Per-document summary notes** as structured Markdown
- **Modern frontend** — Next.js App Router, TypeScript, shadcn/ui, Tailwind CSS, dark-first theme
- **Clean backend** — FastAPI managed with uv, per-workspace ChromaDB collections

## User Stories

1. As a student, I want to create named workspaces for each of my subjects (e.g., "CS101", "Biology Midterm"), so that my study materials stay organized by course.
2. As a student, I want to rename a workspace, so that I can keep my organization current as the semester progresses.
3. As a student, I want to delete a workspace and all its associated data (documents, chat, flashcards, quizzes, summaries, vectors), so that I can keep my app tidy.
4. As a student, I want to upload multiple documents (PDF, DOCX, TXT, MD) to a workspace, so that I can study from all my course materials in one place.
5. As a student, I want to remove an individual document from a workspace (and have its chunks removed from the vector store), so that I can manage outdated materials.
6. As a student, I want to see a list of uploaded documents in a workspace's Documents tab, so that I know what's been indexed.
7. As a student, I want to ask questions about my uploaded documents and receive streaming responses (tokens appear as they arrive), so that I don't stare at a blank screen waiting.
8. As a student, I want inline citations `[1][2]` with page numbers in AI answers, so that I can verify the information against my source documents.
9. As a student, I want to expand a collapsible "Sources" panel below each answer showing the referenced text snippets and page numbers, so that I can read the exact context used.
10. As a student, I want to choose whether my chat queries search all documents in the workspace or a specific document via a dropdown selector, so that I can focus my questions.
11. As a student, I want my chat history to persist per workspace across browser sessions, so that I can continue conversations over multiple study sessions.
12. As a student, I want to clear my chat history within a workspace, so that I can start fresh.
13. As a student, I want to click "Generate Flashcards" and have the AI produce question/answer pairs from my workspace's documents, so that I can test my recall.
14. As a student, I want to flip a flashcard to reveal the answer and rate myself as "Got it" or "Missed it", so that I can track my understanding.
15. As a student, I want a progress bar during flashcard review showing how many cards I've reviewed out of the total, so that I know how much is left.
16. As a student, I want to regenerate flashcards to get a fresh set, so that I can practice with different questions.
17. As a student, I want to click "Generate Quiz" and configure the number of questions (default 10) and difficulty (Easy / Medium / Hard), so that I can test myself at the right level.
18. As a student, I want to take a multiple-choice quiz with instant grading, so that I can assess my knowledge.
19. As a student, I want quiz results to show my score, correct answers, explanations, and source citations for each question, so that I learn from my mistakes.
20. As a student, I want to regenerate quizzes for fresh practice material, so that I can study repeatedly without repetition.
21. As a student, I want to generate structured summary notes for each document (key concepts, definitions, important points), so that I have quick-reference study sheets.
22. As a student, I want summaries displayed as rendered Markdown cards in the Summary Notes tab, so that they're easy to scan before an exam.
23. As a student, I want to regenerate a summary for a specific document, so that I can get a different perspective or updated summary.
24. As a student, I want a sidebar listing all my workspaces with create/rename/delete options, so that navigation is always one click away.
25. As a student, I want tabbed navigation within a workspace (Chat, Documents, Flashcards, Quizzes, Summary Notes), so that I can switch between activities without losing context.
26. As a student, I want a dark theme by default with a light/dark toggle, so that I can study comfortably day or night.
27. As a student, I want the upload area to show processing status (extracting, chunking, embedding), so that I know the system is working.

## Implementation Decisions

### Architecture

- **Repository structure**: `backend/` (FastAPI + uv), `frontend/` (Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui), `run.py` (starts both)
- **Backend manages all state**: SQLite for relational data (workspaces, document metadata, messages, flashcards, quizzes, summaries), ChromaDB for vector embeddings
- **Frontend is a pure API consumer**: Next.js calls FastAPI endpoints, no server-side data logic
- **Single-user, no authentication**: one student, all workspaces belong to them

### Data Model

- **Workspace**: `id`, `name`, `created_at`, `updated_at`
- **Document**: `id`, `workspace_id` (FK), `filename`, `content` (raw extracted text), `uploaded_at`
- **Message**: `id`, `workspace_id` (FK), `role` (user/assistant), `content`, `citations` (JSON), `created_at`
- **Flashcard**: `id`, `workspace_id` (FK), `question`, `answer`, `source_page`, `source_doc`, `created_at`
- **FlashcardReview**: `id`, `flashcard_id` (FK), `result` (got_it/missed_it), `reviewed_at`
- **Quiz**: `id`, `workspace_id` (FK), `difficulty`, `created_at`
- **QuizQuestion**: `id`, `quiz_id` (FK), `question`, `options` (JSON), `correct_option`, `explanation`, `source_page`, `source_doc`
- **Summary**: `id`, `workspace_id` (FK), `document_id` (FK), `content` (Markdown), `created_at`

### LLM & RAG

- **LLM**: Groq API with model `openai/gpt-oss-120b`, OpenAI-compatible client
- **Embeddings**: Local FastEmbed with `BAAI/bge-small-en-v1.5` (zero API cost)
- **Vector store**: One ChromaDB collection per workspace, named `workspace_{id}`
- **Page metadata**: During PDF extraction, track page numbers per chunk. For DOCX/TXT/MD, use sequential section numbering
- **Chunking**: Word-based chunks (~250 words, 20-word overlap) with page number metadata attached
- **Retrieval**: Embed user query, retrieve top-k chunks from the workspace's collection (or filtered by document via metadata), apply distance threshold, return chunks with page metadata
- **Citations**: LLM instructed to cite sources as numbered references; backend maps references to page/snippet metadata and returns them alongside the answer

### API Endpoints

- `GET /api/workspaces` — list workspaces
- `POST /api/workspaces` — create workspace
- `PUT /api/workspaces/{id}` — rename workspace
- `DELETE /api/workspaces/{id}` — delete workspace (cascade: documents, chunks, messages, flashcards, quizzes, summaries)
- `POST /api/workspaces/{id}/documents` — upload document(s)
- `GET /api/workspaces/{id}/documents` — list documents
- `DELETE /api/workspaces/{id}/documents/{doc_id}` — remove document and its chunks
- `POST /api/workspaces/{id}/chat` — streaming SSE chat endpoint (body: message, optional document_id for scoping)
- `GET /api/workspaces/{id}/messages` — chat history
- `DELETE /api/workspaces/{id}/messages` — clear chat
- `POST /api/workspaces/{id}/flashcards/generate` — generate flashcards from workspace documents
- `GET /api/workspaces/{id}/flashcards` — list flashcards
- `POST /api/workspaces/{id}/flashcards/{card_id}/review` — record review result (got_it / missed_it)
- `POST /api/workspaces/{id}/quizzes/generate` — generate quiz (body: count, difficulty)
- `GET /api/workspaces/{id}/quizzes` — list quizzes
- `GET /api/workspaces/{id}/quizzes/{quiz_id}` — get quiz with questions
- `POST /api/workspaces/{id}/summaries/generate` — generate summary for a document (body: document_id)
- `GET /api/workspaces/{id}/summaries` — list summaries

### Frontend

- **Layout**: Persistent left sidebar (workspace list) + main content area with tabs
- **Components**: shadcn/ui Sidebar, Tabs, Card, Button, Input, Select, Dialog, Badge, Progress
- **Chat**: Streaming display using SSE (EventSource or fetch with readable stream), Markdown rendering, collapsible citations panel
- **Flashcards**: Flip animation card component, "Got it" / "Missed it" buttons, progress bar
- **Quizzes**: Radio-button MCQ form, submit for grading, results with score and explanations
- **Summaries**: Rendered Markdown cards per document
- **Theme**: Dark-first with toggle, slate background, green accent for success states, amber for flashcard highlights

### Streaming

- Backend uses FastAPI `StreamingResponse` with `text/event-stream` content type
- Each SSE event contains a JSON payload with `type` (token, citation, done) and `data`
- Frontend consumes via EventSource or fetch with readable stream

## Testing Decisions

### Test seam: Backend API endpoints

- All features tested through FastAPI's `TestClient` — the HTTP API layer is the single test seam
- **LLM calls mocked**: Groq client replaced with deterministic fixtures returning predictable structured responses
- **Real ChromaDB + SQLite**: Temporary per-test instances so the full RAG pipeline (chunking → embedding → retrieval) is tested genuinely
- **Streaming verified**: SSE chat endpoint tested by consuming and asserting on the event stream
- **What makes a good test**: Tests assert on external API behavior (request → response), not on internal function calls or database state. If the API contract is satisfied, the implementation can change freely.

### Modules tested

- Workspace CRUD endpoints
- Document upload and processing pipeline (upload → extract → chunk → embed → store)
- Chat endpoint with retrieval and streaming
- Flashcard generation and review endpoints
- Quiz generation and scoring endpoints
- Summary generation endpoints
- Document deletion (verifies chunks removed from vector store)
- Workspace deletion (verifies cascade cleanup)

### No prior art

The current codebase has zero tests. The test infrastructure (pytest, httpx for async TestClient) will be established as part of the rebuild.

## Out of Scope

- Multi-user authentication and authorization
- Spaced repetition scheduling (Anki-style intervals)
- Real-time collaboration between students
- Mobile app (Expo/React Native)
- Export functionality (PDF export, Anki deck export)
- File types beyond PDF, DOCX, TXT, and MD
- Image/diagram extraction from PDFs
- Frontend component tests (may be added later)
- Deployment configuration (Docker, cloud hosting)

## Further Notes

- The existing codebase will be fully replaced — this is a rebuild, not a refactor. The current `app/`, `static/`, `templates/`, and `requirements.txt` will be removed in favour of the new `backend/` + `frontend/` structure.
- StudyMate shares conceptual DNA with UniMate (university RAG assistant in the same GitHub org), but targets individual students studying any subject, not university-specific document Q&A. The workspace model, flashcards, quizzes, and summaries are unique to StudyMate.
- The `run.py` script at the repo root starts both the backend (`uv run uvicorn`) and the frontend (`npm run dev`) in a single command, following the repo convention.
