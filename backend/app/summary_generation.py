import os

from langchain_groq import ChatGroq


MODEL_NAME = "openai/gpt-oss-120b"


def generate_summary_content(document_name: str, document_content: str, perspective: str | None = None) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    perspective_instruction = (
        f"Write this study guide from this perspective: {perspective.strip()}."
        if perspective and perspective.strip()
        else "Write a balanced, exam-ready study guide."
    )
    model = ChatGroq(model=MODEL_NAME, api_key=api_key, temperature=0.2)
    response = model.invoke(
        [
            (
                "system",
                "You create accurate, useful study guides from source documents. "
                "Return Markdown with these sections: a concise overview, key concepts, "
                "important definitions, important points, and review questions. "
                "Keep claims grounded in the source and say when the source is unclear.",
            ),
            (
                "human",
                f"Document: {document_name}\n{perspective_instruction}\n\n"
                f"Source content:\n{document_content}",
            ),
        ]
    )
    content = response.content
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("The summary model returned an empty response")
    return content.strip()
