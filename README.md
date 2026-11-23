# StudyMate

StudyMate is an AI-powered study companion for organizing course materials and learning from them. Create a workspace for each subject, upload documents, ask questions with page citations, and build active-learning study sets from your sources.

## Features

- Organize study materials into subject workspaces.
- Upload PDF, DOCX, TXT, and Markdown documents.
- Ask questions in a streaming chat grounded in your documents, with page-level citations and source snippets.
- Generate and review flashcards with flip-and-rate progress tracking.
- Create configurable multiple-choice quizzes and review scored answers with explanations and citations.
- Generate structured summary notes for each document.
- Switch between dark and light themes; your choice is saved in the browser.

## Requirements

- Python 3.12 or newer and [uv](https://docs.astral.sh/uv/)
- Node.js and npm
- A Groq API key for chat and study-set generation

## Setup

Install backend dependencies from the backend directory:

```bash
cd backend
uv sync
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Set `GROQ_API_KEY` in your environment before starting the app. For example, in PowerShell:

```powershell
$env:GROQ_API_KEY = "your-groq-api-key"
```

## Run

From the repository root, start the backend and frontend together:

```bash
python run.py
```

The frontend is available at [http://localhost:3000](http://localhost:3000), and the API at [http://localhost:8000](http://localhost:8000). The API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Tech stack

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, Python, SQLite, ChromaDB
- **AI:** Groq chat model for responses and generated study sets; local FastEmbed embeddings
- **Process runner:** Python standard library script to start both development servers
