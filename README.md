# StudyMate

An AI-powered study companion. Organize materials into workspaces, ask grounded questions, and study with flashcards, quizzes, and summaries.

## Project structure

```
StudyMate/
├── backend/     FastAPI API, SQLite data model, ChromaDB client (uv-managed)
├── frontend/    Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
└── run.py       Starts both servers with one command
```

## Getting started

Prerequisites: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js, and npm.

```bash
python run.py
```

The frontend runs at http://localhost:3000 and the API at http://localhost:8000. Press Ctrl+C to stop both servers.

## Development

Backend:

```bash
cd backend
uv sync
uv run pytest
uv run uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run dev
```
