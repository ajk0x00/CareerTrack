"""Prompt template loader with YAML frontmatter LLM configuration."""

from pathlib import Path
import logging
import re
from typing import Any

from langchain_core.messages import BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, ConfigDict, Field
import yaml

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

# Markdown section header -> LangChain chat message role.
_SECTION_ROLES: dict[str, str] = {
    "system": "system",
    "user": "human",
    "assistant": "ai",
}



class PromptLLMConfig(BaseModel):
    """LLM configuration extracted from prompt YAML frontmatter."""

    model_config = ConfigDict(extra="allow")

    model: str = Field(description="Target LLM model identifier")
    temperature: float = Field(default=0.1, ge=0.0, le=2.0, description="Sampling temperature")
    base_url: str = Field(description="Upstream API base URL")


def load_prompt(prompt_name: str, **variables: Any) -> tuple[list[BaseMessage], PromptLLMConfig]:
    """Load and render prompt messages and LLM configuration from app/prompts/{name}.md.

    Supports YAML frontmatter delimited by '---' at the top of the file to configure
    model parameters (model, temperature, base_url). Any omitted parameters
    fall back to the global application Settings.

    Args:
        prompt_name: Base name of the prompt (without file extension).
        **variables: Values for the '{key}' placeholders declared in the prompt body.
            Rendering is delegated to ChatPromptTemplate; every declared placeholder
            must be supplied.

    Returns:
        A tuple of (messages, prompt_llm_config).

    Raises:
        FileNotFoundError: If the Markdown prompt file does not exist.
        ValueError: If role sections (# System, # User) are missing or empty.
    """
    md_path = PROMPTS_DIR / f"{prompt_name}.md"
    if not md_path.is_file():
        raise FileNotFoundError(f"Prompt template not found at {md_path}")

    with open(md_path, "r", encoding="utf-8") as f:
        file_content = f.read()

    settings = get_settings()

    # 1. Parse optional YAML frontmatter delimited by '---'
    frontmatter_match = re.match(r"^\s*---\s*\n(.*?)\n---\s*\n?(.*)$", file_content, re.DOTALL)
    if frontmatter_match:
        yaml_text, raw_md = frontmatter_match.group(1), frontmatter_match.group(2)
        parsed_yaml: dict[str, Any] = yaml.safe_load(yaml_text) or {}
    else:
        parsed_yaml = {}
        raw_md = file_content

    # Merge frontmatter with settings defaults
    model = str(parsed_yaml.get("model") or settings.LLM_MODEL)
    temperature = (
        float(parsed_yaml["temperature"])
        if parsed_yaml.get("temperature") is not None
        else settings.LLM_TEMPERATURE
    )
    base_url = str(parsed_yaml.get("base_url") or settings.LLM_BASE_URL)

    config_data = {
        **parsed_yaml,
        "model": model,
        "temperature": temperature,
        "base_url": base_url,
    }
    prompt_config = PromptLLMConfig.model_validate(config_data)

    # 2. Split the body into role sections and let LangChain own the templating.
    prompt_template = _build_chat_template(md_path, raw_md)

    declared = set(prompt_template.input_variables)
    missing = sorted(declared - set(variables))
    if missing:
        raise ValueError(
            f"Prompt {md_path.name} is missing values for: {', '.join(missing)}."
        )
    unused = sorted(set(variables) - declared)
    if unused:
        logger.debug(
            "Prompt %s received unused variables: %s", md_path.name, ", ".join(unused)
        )

    try:
        messages = prompt_template.format_messages(**variables)
    except (KeyError, ValueError) as exc:
        raise ValueError(
            f"Prompt {md_path.name} could not be rendered: {exc}. "
            "Escape literal braces in the prompt as '{{' and '}}'."
        ) from exc

    return messages, prompt_config


def _build_chat_template(md_path: Path, raw_md: str) -> ChatPromptTemplate:
    """Builds a ChatPromptTemplate from '# System' / '# User' / '# Assistant' sections.

    The section text keeps its '{variable}' placeholders; ChatPromptTemplate parses
    and renders them, so substituted values are never re-interpreted as templates.
    Literal braces in a prompt body must be written as '{{' and '}}'.
    """
    section_pattern = re.compile(
        r"^#\s+(System|User|Assistant)\b",
        re.IGNORECASE | re.MULTILINE,
    )

    matches = list(section_pattern.finditer(raw_md))
    if not matches:
        raise ValueError(
            f"Prompt {md_path} contains no valid role headers (# System, # User, # Assistant)."
        )

    sections: list[tuple[str, str]] = []
    for i, match in enumerate(matches):
        role = _SECTION_ROLES[match.group(1).lower()]
        start_idx = match.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(raw_md)
        content = raw_md[start_idx:end_idx].strip()
        if content:
            sections.append((role, content))

    if not sections:
        raise ValueError(f"Prompt {md_path} has empty role sections.")

    prompt_template = ChatPromptTemplate.from_messages(sections)

    # A '{' that does not open a plain identifier is almost always a literal JSON
    # brace that needs escaping; report it as such instead of a bogus variable.
    unescaped = sorted(
        name for name in prompt_template.input_variables if not name.isidentifier()
    )
    if unescaped:
        raise ValueError(
            f"Prompt {md_path.name} contains unescaped literal braces "
            f"({', '.join(repr(name) for name in unescaped)}); "
            "write literal braces as '{{' and '}}'."
        )

    return prompt_template


def load_prompt_messages(prompt_name: str, **variables: Any) -> list[BaseMessage]:
    """Helper to load only the messages without returning the prompt configuration."""
    messages, _ = load_prompt(prompt_name, **variables)
    return messages
