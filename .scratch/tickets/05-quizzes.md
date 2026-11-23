## Parent

#1

## What to build

A student can generate practice quizzes from their workspace's documents, take them, and see scored results. Clicking "Generate Quiz" opens a configuration form for question count (default 10) and difficulty (Easy / Medium / Hard). The LLM produces multiple-choice questions with correct answers, explanations, and source citations. The student takes the quiz with radio-button selection, submits for instant grading, and sees their score alongside correct answers, explanations, and cited sources for each question. They can regenerate for fresh material.

## Acceptance criteria

- [ ] `POST /api/workspaces/{id}/quizzes/generate` accepts `count` and `difficulty` and generates MCQ questions via the LLM
- [ ] Generated questions include `options` (JSON), `correct_option`, `explanation`, `source_page`, and `source_doc`
- [ ] `GET /api/workspaces/{id}/quizzes` lists all quizzes for the workspace
- [ ] `GET /api/workspaces/{id}/quizzes/{quiz_id}` returns a quiz with its questions
- [ ] Frontend Quizzes tab has a "Generate Quiz" button with count and difficulty configuration
- [ ] Quiz-taking UI uses radio buttons for MCQ selection
- [ ] Submit grades the quiz and shows score, correct answers, explanations, and source citations
- [ ] Regenerate creates a fresh quiz
- [ ] Backend API tests verify quiz generation, retrieval, and scoring (LLM mocked)

## Blocked by

- #4 (Streaming chat with RAG & citations)
