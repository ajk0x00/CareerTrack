from datetime import datetime
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AddressSchema(BaseModel):
    """Structured postal address schema with strict string validations."""
    model_config = ConfigDict(extra="forbid")

    street: str | None = Field(None, max_length=255, description="Street address line")
    city: str | None = Field(None, max_length=100, description="City or municipality")
    state: str | None = Field(None, max_length=100, description="State, province, or region")
    postal_code: str | None = Field(None, max_length=20, description="Postal or ZIP code")
    country: str | None = Field(None, max_length=100, description="Country name or ISO code")

    @field_validator("street", "city", "state", "postal_code", "country", mode="before")
    @classmethod
    def clean_str(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None


class SocialsSchema(BaseModel):
    """Social links schema with strict HTTP/HTTPS URL validations."""
    model_config = ConfigDict(extra="allow")

    linkedin: str | None = Field(None, max_length=500, description="LinkedIn profile URL")
    github: str | None = Field(None, max_length=500, description="GitHub profile URL")
    twitter: str | None = Field(None, max_length=500, description="Twitter / X profile URL")
    portfolio: str | None = Field(None, max_length=500, description="Personal portfolio URL")
    website: str | None = Field(None, max_length=500, description="Personal website URL")

    @field_validator("*", mode="before")
    @classmethod
    def validate_url(cls, v: Any) -> str | None:
        if v is None:
            return None
        url = str(v).strip()
        if not url:
            return None
        # Strict URL validator enforcing protocol and valid domain structure
        pattern = r"^https?://([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(:\d+)?(/.*)?$"
        if not re.match(pattern, url):
            raise ValueError(f"Invalid URL format: '{url}'. Must start with http:// or https:// and contain a valid domain.")
        return url


class ProfileBase(BaseModel):
    """Base profile schema containing strictly validated user identity fields."""
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, max_length=255, description="Full display name")
    phone: str | None = Field(None, max_length=50, description="Contact phone number")
    email: str | None = Field(None, max_length=255, description="Primary contact email")
    socials: SocialsSchema | dict[str, str] | None = Field(
        default=None, description="Key-value mapping of social platform handles and URLs"
    )
    address: AddressSchema | dict[str, str] | None = Field(
        default=None, description="Structured physical address details"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        name = v.strip()
        if not name:
            return None
        if len(name) < 1 or len(name) > 255:
            raise ValueError("Name must be between 1 and 255 characters")
        if not any(c.isalpha() for c in name):
            raise ValueError("Name must contain at least one alphabetic character")
        # Strict name check: letters, digits, spaces, hyphens, periods, and unicode accents
        if not re.match(r"^[\w\s\.\'\,\-]+$", name, re.UNICODE):
            raise ValueError("Name contains invalid characters")
        return name

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        phone = v.strip()
        if not phone:
            return None
        # Strict phone format: optional leading '+', digits, spaces, hyphens, parentheses, dots
        pattern = r"^\+?[0-9\s\-\(\)\.]{7,25}$"
        if not re.match(pattern, phone):
            raise ValueError("Invalid phone number format. Allowed characters: digits, +, -, (, ), ., and spaces.")
        digits_only = re.sub(r"\D", "", phone)
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise ValueError("Phone number must contain between 7 and 15 digits according to E.164 standards.")
        return phone

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        email = v.strip().lower()
        if not email:
            return None
        pattern = r"^[\w\.\+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-\.]+$"
        if not re.match(pattern, email):
            raise ValueError("Invalid email address format")
        return email

    @field_validator("socials")
    @classmethod
    def validate_socials(cls, v: Any) -> dict[str, str] | None:
        if v is None:
            return None
        data = v.model_dump(exclude_none=True) if isinstance(v, BaseModel) else v
        if not isinstance(data, dict):
            raise ValueError("Socials must be a valid mapping of platform to URL")
        platform_pattern = r"^[a-zA-Z0-9_\-]+$"
        url_pattern = r"^https?://([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(:\d+)?(/.*)?$"
        cleaned: dict[str, str] = {}
        for platform, url in data.items():
            p_str = str(platform).strip().lower()
            if not re.match(platform_pattern, p_str):
                raise ValueError(
                    f"Invalid social platform identifier '{platform}'. Must be alphanumeric, hyphen, or underscore."
                )
            if not url:
                continue
            url_str = str(url).strip()
            if not re.match(url_pattern, url_str):
                raise ValueError(f"Invalid URL for platform '{platform}': {url_str}")
            cleaned[p_str] = url_str
        return cleaned

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: Any) -> dict[str, str] | None:
        if v is None:
            return None
        data = v.model_dump(exclude_none=True) if isinstance(v, BaseModel) else v
        if not isinstance(data, dict):
            raise ValueError("Address must be a valid mapping of address fields")
        allowed = {"street", "city", "state", "postal_code", "country"}
        cleaned: dict[str, str] = {}
        for key, val in data.items():
            key_str = str(key).strip().lower()
            if key_str not in allowed:
                raise ValueError(f"Invalid address field '{key}'. Allowed fields: {', '.join(sorted(allowed))}")
            if val is not None:
                val_str = str(val).strip()
                if val_str:
                    if len(val_str) > 255:
                        raise ValueError(f"Address field '{key}' exceeds 255 characters")
                    cleaned[key_str] = val_str
        return cleaned


class ProfileCreate(ProfileBase):
    """Schema for initializing/creating user profile."""
    pass


class ProfileUpdate(ProfileBase):
    """Schema for updating/patching user profile fields."""
    pass


class ProfileResponse(BaseModel):
    """Schema for returning user profile details."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str | None = None
    phone: str | None = None
    socials: dict[str, str] | None = None
    address: dict[str, str] | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
