## Parent

#1

## What to build

A student can generate structured summary notes for each document in their workspace. The Summary Notes tab lists all documents; clicking "Generate Summary" for a document sends its content to the LLM, which produces a structured Markdown study guide with key concepts, definitions, and important points. Summaries are displayed as rendered Markdown cards. The student can regenerate a summary for a different perspective.

## Acceptance criteria

- [ ] `POST /api/workspaces/{id}/summaries/generate` accepts a `document_id` and generates a Markdown summary via the LLM
- [ ] `GET /api/workspaces/{id}/summaries` returns all summaries for the workspace
- [ ] Generated summaries are structured Markdown with key concepts, definitions, and important points
- [ ] Regenerating a summary for the same document replaces the previous one
- [ ] Frontend Summary Notes tab lists documents with a "Generate Summary" action
- [ ] Summaries render as Markdown cards
- [ ] Backend API tests verify summary generation, listing, and regeneration (LLM mocked)

## Blocked by

- #3 (Document upload & processing pipeline)
