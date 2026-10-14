"""Prompt template loader with YAML frontmatter LLM configuration."""

from pathlib import Path
import re
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, ConfigDict, Field
import yaml

from app.core.config import get_settings

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


class PromptLLMConfig(BaseModel):
    """LLM configuration extracted from prompt YAML frontmatter."""

    model_config = ConfigDict(extra="allow")

    model: str = Field(description="Target LLM model identifier")
    temperature: float = Field(default=0.1, ge=0.0, le=2.0, description="Sampling temperature")
    base_url: str = Field(description="Upstream API base URL")


def load_prompt(name: str, **variables: Any) -> tuple[list[BaseMessage], PromptLLMConfig]:
    """Load and render prompt messages and LLM configuration from app/prompts/{name}.md.

    Supports YAML frontmatter delimited by '---' at the top of the file to configure
    model parameters (model, temperature, base_url). Any omitted parameters
    fall back to the global application Settings.

    Args:
        name: Base name of the prompt (without file extension).
        **variables: Keyword arguments to replace '{key}' placeholders in the prompt.

    Returns:
        A tuple of (messages, prompt_llm_config).

    Raises:
        FileNotFoundError: If the Markdown prompt file does not exist.
        ValueError: If role sections (# System, # User) are missing or empty.
    """
    md_path = PROMPTS_DIR / f"{name}.md"
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

    # 2. Substitute variable placeholders safely (avoids format() KeyError on JSON braces)
    for key, value in variables.items():
        placeholder = f"{{{key}}}"
        raw_md = raw_md.replace(placeholder, str(value))

    # 3. Parse sections delimited by '# System', '# User', '# Assistant' headers
    section_pattern = re.compile(
        r"^#\s+(System|User|Assistant)\b",
        re.IGNORECASE | re.MULTILINE,
    )

    matches = list(section_pattern.finditer(raw_md))
    if not matches:
        raise ValueError(
            f"Prompt {md_path} contains no valid role headers (# System, # User, # Assistant)."
        )

    messages: list[BaseMessage] = []
    for i, match in enumerate(matches):
        role = match.group(1).lower()
        start_idx = match.end()
        end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(raw_md)
        content = raw_md[start_idx:end_idx].strip()
        if not content:
            continue

        if role == "system":
            messages.append(SystemMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))

    if not messages:
        raise ValueError(f"Prompt {md_path} has empty role sections.")

    return messages, prompt_config


def load_prompt_messages(name: str, **variables: Any) -> list[BaseMessage]:
    """Helper to load only the messages without returning the prompt configuration."""
    messages, _ = load_prompt(name, **variables)
    return messages
