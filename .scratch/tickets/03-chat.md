## Parent

#1

## What to build

A student can ask questions in the Chat tab and receive streaming AI responses with inline citations. The backend retrieves relevant chunks from the workspace's ChromaDB collection (or filtered to a specific document), sends them as context to the Groq LLM, and streams the response back via SSE. Each answer includes numbered citations like `[1][2]` linking to specific page numbers and text snippets. Below each answer, a collapsible Sources panel shows the referenced snippets. Chat history persists per workspace across browser sessions and can be cleared.

## Acceptance criteria

- [ ] `POST /api/workspaces/{id}/chat` accepts a message (and optional `document_id` for scoping) and returns a streaming SSE response
- [ ] SSE events include `token`, `citation`, and `done` event types
- [ ] LLM responses include inline `[1][2]` citations mapped to page numbers and source snippets
- [ ] Retrieval uses the workspace's ChromaDB collection with top-k nearest chunks and distance threshold
- [ ] Document-scope filtering works when a `document_id` is provided
- [ ] `GET /api/workspaces/{id}/messages` returns persisted chat history
- [ ] `DELETE /api/workspaces/{id}/messages` clears chat history for a workspace
- [ ] Frontend Chat tab renders streaming tokens as they arrive with Markdown formatting
- [ ] Collapsible Sources panel below each answer shows cited snippets and page numbers
- [ ] Document-scope dropdown lets the student filter queries to a specific document or all documents
- [ ] Backend API tests verify streaming SSE output, citation mapping, and chat history CRUD (LLM mocked with deterministic fixtures)

## Blocked by

- #3 (Document upload & processing pipeline)
