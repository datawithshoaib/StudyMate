# StudyMate API

FastAPI backend for StudyMate. Manages workspaces and their relational data in SQLite and initializes the shared ChromaDB client.

## Development

Run commands from this directory so uv uses `backend/.venv`:

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
```

Set `NEXT_PUBLIC_API_URL` in the frontend when the API is not at `http://localhost:8000`.
