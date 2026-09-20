"""Request bodies for saving scans."""
from __future__ import annotations

from typing import Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DoorIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[Union[str, int]] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    material: Optional[str] = None
    confidence: Optional[float] = None
    image: Optional[str] = None  # small JPEG thumbnail as a data URL (or null)

    @field_validator("id")
    @classmethod
    def _id_to_str(cls, value):
        return None if value is None else str(value)


class ScanIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = None
    site: Optional[str] = None  # what the person typed as the site name (may be empty)
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    doors: list[DoorIn] = Field(default_factory=list)
