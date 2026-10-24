"""ATS-safe PDF rendering and verification for resume Markdown."""

from dataclasses import dataclass, field
from html import escape
import io
import re

from pypdf import PdfReader
import weasyprint

from app.schemas.resume import AtsReport

_MAX_PAGES = 2
_BULLET_WORD_LIMIT = 5

_HEADING_PATTERN = re.compile(r"^(#{1,3})\s+(.+)$")
_TABLE_SEPARATOR_PATTERN = re.compile(
    r"^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$"
)
_LINK_PATTERN = re.compile(r"\[([^\]]*)\]\(([^)\s]*)\)")
_BOLD_PATTERN = re.compile(r"\*\*(.+?)\*\*")
_ITALIC_PATTERN = re.compile(r"\*(?=\S)(.+?)(?<=\S)\*")
_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

_MULTI_COLUMN_MARKERS: tuple[str, ...] = (":::", "<!-- column")

_STOPWORDS: frozenset[str] = frozenset(
    {
        "about",
        "after",
        "again",
        "against",
        "also",
        "among",
        "another",
        "any",
        "are",
        "because",
        "been",
        "before",
        "being",
        "between",
        "both",
        "but",
        "can",
        "could",
        "did",
        "does",
        "doing",
        "done",
        "during",
        "each",
        "either",
        "else",
        "every",
        "for",
        "from",
        "further",
        "had",
        "has",
        "have",
        "having",
        "her",
        "here",
        "hers",
        "him",
        "his",
        "how",
        "into",
        "its",
        "itself",
        "just",
        "may",
        "more",
        "most",
        "must",
        "not",
        "now",
        "off",
        "once",
        "only",
        "other",
        "our",
        "ours",
        "out",
        "over",
        "own",
        "same",
        "she",
        "should",
        "some",
        "such",
        "than",
        "that",
        "the",
        "their",
        "theirs",
        "them",
        "then",
        "there",
        "these",
        "they",
        "this",
        "those",
        "through",
        "too",
        "under",
        "until",
        "very",
        "was",
        "were",
        "what",
        "when",
        "where",
        "which",
        "while",
        "who",
        "whom",
        "why",
        "will",
        "with",
        "would",
        "you",
        "your",
        "yours",
    }
)

_CSS = """
@page {
    size: A4;
    margin: 12mm 14mm;
}
* {
    box-sizing: border-box;
}
body {
    margin: 0;
    font-family: "Liberation Sans", Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #000;
    hyphens: none;
    -weasy-hyphens: none;
    font-variant-ligatures: none;
}
h1 {
    font-size: 18pt;
    font-weight: bold;
    margin: 0 0 1.5mm;
}
h2 {
    font-size: 11.5pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 4mm 0 1.8mm;
    padding-bottom: 0.6mm;
    border-bottom: 0.4pt solid #000;
}
h3 {
    font-size: 10.5pt;
    font-weight: bold;
    margin: 2.5mm 0 1.2mm;
}
p {
    margin: 0 0 1.4mm;
}
ul {
    margin: 0 0 1.4mm;
    padding-left: 5mm;
}
li {
    margin-bottom: 0.8mm;
}
strong {
    font-weight: bold;
}
"""


@dataclass
class _RenderedMarkdown:
    """Structured output of the strict Markdown renderer."""

    html: str
    headings: list[str] = field(default_factory=list)
    section_headings: list[str] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)
    bold_tokens: list[str] = field(default_factory=list)


def _normalize_text(value: str) -> str:
    """Collapses whitespace and case so PDF extraction quirks do not cause false mismatches."""
    return " ".join(value.split()).casefold()


def _plain_text(value: str) -> str:
    """Strips supported inline Markdown so text can be compared with extracted PDF text."""
    without_links = _LINK_PATTERN.sub(lambda match: match.group(1), value)
    return without_links.replace("**", "").replace("*", "")


def _collect_bold_tokens(value: str, collector: list[str]) -> None:
    """Collects the inner text of every bold span in a line."""
    for match in _BOLD_PATTERN.finditer(value):
        token = _plain_text(match.group(1)).strip()
        if token:
            collector.append(token)


def _render_inline(value: str) -> str:
    """Escapes all text then applies the small supported inline Markdown subset."""
    escaped = escape(value)
    escaped = _LINK_PATTERN.sub(lambda match: match.group(1), escaped)
    escaped = _BOLD_PATTERN.sub(lambda match: f"<strong>{match.group(1)}</strong>", escaped)
    escaped = _ITALIC_PATTERN.sub(lambda match: f"<em>{match.group(1)}</em>", escaped)
    return escaped


def _validate_line(line_number: int, line: str, next_line: str | None) -> None:
    """Rejects constructs that are unsafe or unparseable by an ATS."""
    stripped = line.strip()

    if "```" in line:
        raise ValueError(f"Line {line_number}: fenced code blocks are not supported")
    if "![" in line:
        raise ValueError(f"Line {line_number}: markdown images are not supported")
    if "<" in line:
        raise ValueError(f"Line {line_number}: raw HTML is not supported")
    if re.match(r"^\s*#{4,}(\s|$)", line):
        raise ValueError(f"Line {line_number}: headings deeper than h3 are not supported")
    if re.match(r"^\s+[-*]\s+", line):
        raise ValueError(f"Line {line_number}: nested lists are not supported")
    if any(marker in stripped for marker in _MULTI_COLUMN_MARKERS):
        raise ValueError(f"Line {line_number}: multi-column markers are not supported")
    if "|" in line and (
        _TABLE_SEPARATOR_PATTERN.match(line) is not None
        or (next_line is not None and _TABLE_SEPARATOR_PATTERN.match(next_line) is not None)
    ):
        raise ValueError(f"Line {line_number}: markdown tables are not supported")


def _render_markdown(markdown: str) -> _RenderedMarkdown:
    """Renders the supported Markdown subset into strict single-column HTML."""
    rendered = _RenderedMarkdown(html="")
    lines = markdown.splitlines()

    for index, line in enumerate(lines):
        next_line = lines[index + 1] if index + 1 < len(lines) else None
        _validate_line(index + 1, line, next_line)

    parts: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if not stripped or stripped == "---":
            index += 1
            continue

        heading_match = _HEADING_PATTERN.match(line)
        if heading_match is not None:
            level = len(heading_match.group(1))
            heading_text = heading_match.group(2).strip()
            _collect_bold_tokens(heading_text, rendered.bold_tokens)
            rendered.headings.append(heading_text)
            if level == 2:
                rendered.section_headings.append(heading_text)
            parts.append(f"<h{level}>{_render_inline(heading_text)}</h{level}>")
            index += 1
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            item_parts: list[str] = []
            while index < len(lines):
                candidate = lines[index].strip()
                if not (candidate.startswith("- ") or candidate.startswith("* ")):
                    break
                item_text = candidate[2:].strip()
                _collect_bold_tokens(item_text, rendered.bold_tokens)
                rendered.bullets.append(item_text)
                item_parts.append(f"<li>{_render_inline(item_text)}</li>")
                index += 1
            parts.append("<ul>" + "".join(item_parts) + "</ul>")
            continue

        _collect_bold_tokens(stripped, rendered.bold_tokens)
        parts.append(f"<p>{_render_inline(stripped)}</p>")
        index += 1

    rendered.html = "".join(parts)
    return rendered


def _build_document(body_html: str, user_name: str) -> str:
    """Wraps rendered body HTML into a single-column A4 document."""
    return (
        "<!DOCTYPE html>"
        '<html lang="en"><head><meta charset="utf-8">'
        f"<title>{escape(user_name)}</title>"
        f"<style>{_CSS}</style></head><body>{body_html}</body></html>"
    )


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extracts text from every PDF page."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


class ResumeExportService:
    """Renders stored resume Markdown to an ATS-safe PDF and verifies the result."""

    @staticmethod
    def extract_text(pdf_bytes: bytes) -> str:
        """Extracts the text layer from a rendered PDF."""
        return _extract_pdf_text(pdf_bytes)

    @staticmethod
    def render_pdf(markdown: str, user_name: str) -> tuple[bytes, AtsReport, list[str]]:
        """Renders Markdown to PDF bytes and verifies headings, bullets, bold text, and pages."""
        rendered = _render_markdown(markdown)
        document = _build_document(rendered.html, user_name)
        pdf_bytes = weasyprint.HTML(string=document).write_pdf()

        reader = PdfReader(io.BytesIO(pdf_bytes))
        page_count = len(reader.pages)
        text = _extract_pdf_text(pdf_bytes)
        normalized_text = _normalize_text(text)

        missing_tokens: list[str] = []

        for heading in rendered.headings:
            if _normalize_text(heading) not in normalized_text:
                missing_tokens.append(heading)

        previous_offset = -1
        order_ok = True
        for heading in rendered.headings:
            offset = normalized_text.find(_normalize_text(heading))
            if offset < 0:
                continue
            if offset <= previous_offset:
                order_ok = False
                break
            previous_offset = offset

        for bullet in rendered.bullets:
            words = _plain_text(bullet).split()
            if not words:
                continue
            probe = _normalize_text(" ".join(words[:_BULLET_WORD_LIMIT]))
            if probe and probe not in normalized_text:
                missing_tokens.append(" ".join(words[:_BULLET_WORD_LIMIT]))

        for bold_token in rendered.bold_tokens:
            if _normalize_text(bold_token) not in normalized_text:
                missing_tokens.append(bold_token)

        if "\ufffd" in text:
            missing_tokens.append("\ufffd")

        missing_tokens = list(dict.fromkeys(missing_tokens))
        parse_clean = (
            not missing_tokens and order_ok and page_count <= _MAX_PAGES
        )

        report = AtsReport(
            parse_clean=parse_clean,
            char_count=len(text),
            page_count=page_count,
            sections_found=list(rendered.section_headings),
            missing_tokens=missing_tokens,
            keyword_coverage=None,
            matched_keywords=[],
            missing_keywords=[],
        )
        return pdf_bytes, report, missing_tokens


def _tokenize(value: str) -> set[str]:
    """Tokenizes on non-alphanumerics, lowercases, and drops short or common words."""
    return {
        token
        for token in _TOKEN_PATTERN.findall(value.lower())
        if len(token) > 2 and token not in _STOPWORDS
    }


def build_keyword_coverage(
    pdf_text: str,
    requirements_text: str,
) -> tuple[float | None, list[str], list[str]]:
    """Reports the fraction of distinct requirement tokens present in the resume text."""
    requirement_tokens = _tokenize(requirements_text)
    if not requirement_tokens:
        return None, [], []

    resume_tokens = _tokenize(pdf_text)
    matched = sorted(requirement_tokens & resume_tokens)
    missing = sorted(requirement_tokens - resume_tokens)
    coverage = len(matched) / len(requirement_tokens)
    return coverage, matched, missing
