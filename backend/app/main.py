from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import chat, documents, flashcards, quizzes, summaries, workspaces
from app.vector_store import create_chroma_client


def create_app(db_path: Path | None = None, chroma_path: Path | None = None) -> FastAPI:
    db_path = db_path or Path("studymate.db")
    chroma_path = chroma_path or Path("chroma_db")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(db_path)
        app.state.db_path = db_path
        app.state.chroma_client = create_chroma_client(chroma_path)
        yield

    app = FastAPI(title="StudyMate API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(workspaces.router)
    app.include_router(documents.router)
    app.include_router(chat.router)
    app.include_router(flashcards.router)
    app.include_router(quizzes.router)
    app.include_router(summaries.router)
    return app


app = create_app()
