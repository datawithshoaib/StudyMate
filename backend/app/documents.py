import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pdfplumber
from docx import Document as DocxDocument

CHUNK_WORDS = 250
OVERLAP_WORDS = 20


@dataclass(frozen=True)
class ExtractedSection:
    number: int
    text: str


@dataclass(frozen=True)
class Chunk:
    text: str
    page: int


def extract_sections(filename: str, content: bytes) -> list[ExtractedSection]:
    suffix = Path(filename).suffix.lower()
    if suffix in {".txt", ".md"}:
        text = content.decode("utf-8")
        blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
        return [ExtractedSection(number, block) for number, block in enumerate(blocks, start=1)]
    if suffix == ".pdf":
        with pdfplumber.open(BytesIO(content)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        return [
            ExtractedSection(number, page.strip())
            for number, page in enumerate(pages, start=1)
            if page.strip()
        ]
    if suffix == ".docx":
        document = DocxDocument(BytesIO(content))
        paragraphs = [
            paragraph.text.strip()
            for paragraph in document.paragraphs
            if paragraph.text.strip()
        ]
        return [
            ExtractedSection(number, paragraph)
            for number, paragraph in enumerate(paragraphs, start=1)
        ]
    raise ValueError(f"Unsupported document type: {suffix or 'unknown'}")


def chunk_sections(
    sections: list[ExtractedSection],
    chunk_words: int = CHUNK_WORDS,
    overlap_words: int = OVERLAP_WORDS,
) -> list[Chunk]:
    words: list[str] = []
    pages: list[int] = []
    for section in sections:
        section_words = section.text.split()
        words.extend(section_words)
        pages.extend([section.number] * len(section_words))

    chunks: list[Chunk] = []
    step = chunk_words - overlap_words
    for start in range(0, len(words), step):
        chunk_words_slice = words[start : start + chunk_words]
        if not chunk_words_slice:
            break
        chunks.append(Chunk(" ".join(chunk_words_slice), pages[start]))
        if start + chunk_words >= len(words):
            break
    return chunks
