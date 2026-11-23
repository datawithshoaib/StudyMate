import json
import os
import re

from langchain_groq import ChatGroq

MODEL_NAME = "openai/gpt-oss-120b"


def generate_flashcards(documents: list[dict[str, str]]) -> list[dict[str, object]]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    source_text = "\n\n".join(
        f"Document: {document['filename']}\n{document['content']}" for document in documents
    )
    response = ChatGroq(model=MODEL_NAME, api_key=api_key, temperature=0.3).invoke(
        [
            (
                "system",
                "Create concise, accurate study flashcards from the supplied documents. "
                "Return only a JSON array of objects with question, answer, source_page, "
                "and source_doc fields. source_doc must match a supplied filename; "
                "source_page must be a positive page or section number, or null when unknown. "
                "Do not invent facts or citations.",
            ),
            ("human", f"Documents:\n{source_text}"),
        ]
    )
    content = response.content
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("The flashcard model returned an empty response")
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE)
    try:
        cards = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The flashcard model returned invalid JSON") from exc
    if not isinstance(cards, list):
        raise RuntimeError("The flashcard model response must be a JSON array")
    return cards
