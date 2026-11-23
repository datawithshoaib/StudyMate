## Parent

#1

## What to build

A student can generate flashcards from their workspace's documents and review them with a flip-and-rate flow. Clicking "Generate Flashcards" in the Flashcards tab sends workspace content to the LLM, which produces question/answer pairs with source page references. The student flips each card to reveal the answer, rates themselves as "Got it" or "Missed it", and sees a progress bar tracking their review session. They can regenerate for a fresh set.

## Acceptance criteria

- [ ] `POST /api/workspaces/{id}/flashcards/generate` generates Q/A flashcards from workspace documents via the LLM
- [ ] Generated flashcards include `source_page` and `source_doc` metadata
- [ ] `GET /api/workspaces/{id}/flashcards` returns the current set of flashcards
- [ ] `POST /api/workspaces/{id}/flashcards/{card_id}/review` records a "got_it" or "missed_it" result
- [ ] Regenerating replaces the existing flashcard set with fresh cards
- [ ] Frontend Flashcards tab shows a card with flip animation to reveal the answer
- [ ] "Got it" and "Missed it" buttons record the review and advance to the next card
- [ ] Progress bar shows cards reviewed out of total
- [ ] Backend API tests verify flashcard generation, listing, review recording, and regeneration (LLM mocked)

## Blocked by

- #4 (Streaming chat with RAG & citations)
