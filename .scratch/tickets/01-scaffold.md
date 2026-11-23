## Parent

#1

## What to build

Set up the full project structure and get workspace CRUD working end-to-end. A student can open the app, see a sidebar listing workspaces, create a new workspace, rename it, and delete it (with cascade cleanup of all associated data). Selecting a workspace shows an empty workspace view with tabbed navigation (Chat, Documents, Flashcards, Quizzes, Summary Notes).

The old codebase (`app/`, `static/`, `templates/`, `requirements.txt`) is removed and replaced with:
- `backend/` — FastAPI managed with uv, SQLite database with the full data model (Workspace, Document, Message, Flashcard, FlashcardReview, Quiz, QuizQuestion, Summary tables), ChromaDB client initialization
- `frontend/` — Next.js App Router with TypeScript, Tailwind CSS, shadcn/ui components
- `run.py` at repo root — starts both backend and frontend with a single command

## Acceptance criteria

- [ ] Old `app/`, `static/`, `templates/`, `requirements.txt` removed
- [ ] `backend/` with FastAPI app, uv-managed dependencies, SQLite database with all tables created on startup
- [ ] `frontend/` with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui initialized
- [ ] `run.py` at repo root starts both backend and frontend
- [ ] `GET /api/workspaces` returns list of workspaces
- [ ] `POST /api/workspaces` creates a workspace with a name
- [ ] `PUT /api/workspaces/{id}` renames a workspace
- [ ] `DELETE /api/workspaces/{id}` deletes a workspace and cascades to all related data
- [ ] Frontend sidebar lists workspaces with create, rename, and delete actions
- [ ] Selecting a workspace shows tabbed navigation (Chat, Documents, Flashcards, Quizzes, Summary Notes)
- [ ] Backend API tests for workspace CRUD using FastAPI TestClient with real SQLite
