## Parent

#1

## What to build

A student can upload PDF, DOCX, TXT, and Markdown files to a workspace. The backend extracts text with page-level metadata, splits it into ~250-word chunks with 20-word overlap, embeds each chunk using FastEmbed (BAAI/bge-small-en-v1.5), and stores vectors in a per-workspace ChromaDB collection. The Documents tab lists all uploaded files. A student can delete a document, which removes its chunks from the vector store. The upload area shows processing status (extracting → chunking → embedding).

## Acceptance criteria

- [ ] `POST /api/workspaces/{id}/documents` accepts PDF, DOCX, TXT, and MD file uploads
- [ ] Text extraction works for all four formats with page number tracking (sequential section numbering for non-PDF)
- [ ] Chunks are ~250 words with 20-word overlap, each carrying page number metadata
- [ ] Chunks are embedded with FastEmbed and stored in a ChromaDB collection named `workspace_{id}`
- [ ] `GET /api/workspaces/{id}/documents` returns the list of documents in a workspace
- [ ] `DELETE /api/workspaces/{id}/documents/{doc_id}` removes the document and its chunks from both SQLite and ChromaDB
- [ ] Frontend Documents tab lists uploaded documents with a delete option
- [ ] Upload area shows processing status (extracting, chunking, embedding)
- [ ] Backend API tests verify the full upload → extract → chunk → embed → store pipeline using real ChromaDB and SQLite
- [ ] Backend API tests verify document deletion removes chunks from vector store

## Blocked by

- #2 (Project scaffold & workspace CRUD)
