import json
import os
import re

from langchain_groq import ChatGroq

MODEL_NAME = "openai/gpt-oss-120b"


def generate_quiz_questions(documents: list[dict[str, str]], count: int, difficulty: str) -> list[dict]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")
    context = "\n\n".join(
        f"SOURCE {index}: {document['filename']} (page {document['page']})\n{document['content']}"
        for index, document in enumerate(documents, start=1)
    )
    model = ChatGroq(model=MODEL_NAME, api_key=api_key, temperature=0.2)
    response = model.invoke([
        ("system", "Create accurate multiple-choice study questions using only the source material. "
         "Return only a JSON array of objects with keys question, options (exactly 4 strings), "
         "correct_option (zero-based integer), explanation, source_page (integer), and source_doc "
         "(exact filename from source). Do not wrap JSON in markdown."),
        ("human", f"Difficulty: {difficulty}. Create exactly {count} questions.\n\n{context}"),
    ])
    content = response.content
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("The quiz model returned an empty response")
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE)
    try:
        questions = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The quiz model returned invalid JSON") from exc
    if not isinstance(questions, list) or len(questions) != count:
        raise RuntimeError("The quiz model returned an unexpected number of questions")
    valid_sources = {(document["filename"], int(document["page"])) for document in documents}
    for question in questions:
        if (not isinstance(question, dict) or not isinstance(question.get("question"), str)
                or not isinstance(question.get("options"), list) or len(question["options"]) != 4
                or not all(isinstance(option, str) for option in question["options"])
                or not isinstance(question.get("correct_option"), int)
                or not 0 <= question["correct_option"] < 4
                or not isinstance(question.get("explanation"), str)
                or (question.get("source_doc"), question.get("source_page")) not in valid_sources):
            raise RuntimeError("The quiz model returned an invalid question")
    return questions
