from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.skill import SkillProficiency


class SkillBase(BaseModel):
    """Base schema for user skill attributes."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the technical or professional skill",
    )
    proficiency: SkillProficiency = Field(
        default=SkillProficiency.INTERMEDIATE,
        description="Proficiency level (beginner, intermediate, advanced, expert)",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Skill name cannot be empty or only whitespace")
        if len(stripped) > 100:
            raise ValueError("Skill name must not exceed 100 characters")
        return stripped

    @field_validator("proficiency", mode="before")
    @classmethod
    def normalize_proficiency(cls, v: Any) -> Any:
        if isinstance(v, str):
            normalized = v.strip().lower().replace("-", "_").replace(" ", "_")
            alias_map = {
                "novice": SkillProficiency.BEGINNER.value,
                "basic": SkillProficiency.BEGINNER.value,
                "entry": SkillProficiency.BEGINNER.value,
                "proficient": SkillProficiency.INTERMEDIATE.value,
                "medium": SkillProficiency.INTERMEDIATE.value,
                "senior": SkillProficiency.ADVANCED.value,
                "lead": SkillProficiency.EXPERT.value,
                "master": SkillProficiency.EXPERT.value,
            }
            if normalized in alias_map:
                return alias_map[normalized]
            return normalized
        return v


class SkillCreate(SkillBase):
    """Schema for creating a new user skill."""

    pass


class SkillUpdate(BaseModel):
    """Schema for updating an existing user skill."""

    name: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        description="Updated skill name",
    )
    proficiency: SkillProficiency | None = Field(
        None,
        description="Updated proficiency level",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Skill name cannot be empty or only whitespace")
        if len(stripped) > 100:
            raise ValueError("Skill name must not exceed 100 characters")
        return stripped

    @field_validator("proficiency", mode="before")
    @classmethod
    def normalize_proficiency(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            normalized = v.strip().lower().replace("-", "_").replace(" ", "_")
            alias_map = {
                "novice": SkillProficiency.BEGINNER.value,
                "basic": SkillProficiency.BEGINNER.value,
                "entry": SkillProficiency.BEGINNER.value,
                "proficient": SkillProficiency.INTERMEDIATE.value,
                "medium": SkillProficiency.INTERMEDIATE.value,
                "senior": SkillProficiency.ADVANCED.value,
                "lead": SkillProficiency.EXPERT.value,
                "master": SkillProficiency.EXPERT.value,
            }
            if normalized in alias_map:
                return alias_map[normalized]
            return normalized
        return v


class SkillResponse(BaseModel):
    """Schema for returning user skill details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    proficiency: SkillProficiency
    created_at: datetime
    updated_at: datetime
