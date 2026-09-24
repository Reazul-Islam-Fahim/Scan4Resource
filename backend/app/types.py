"""Small shared types."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class Box:
    """A box in normalised image coordinates (0 to 1), origin top left."""

    x: float
    y: float
    w: float
    h: float

    @property
    def x1(self) -> float:
        return self.x + self.w

    @property
    def y1(self) -> float:
        return self.y + self.h

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.w / 2, self.y + self.h / 2)

    @property
    def area(self) -> float:
        return max(0.0, self.w) * max(0.0, self.h)

    def iou(self, other: "Box") -> float:
        ix0, iy0 = max(self.x, other.x), max(self.y, other.y)
        ix1, iy1 = min(self.x1, other.x1), min(self.y1, other.y1)
        inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
        union = self.area + other.area - inter
        return inter / union if union > 0 else 0.0

    def center_distance(self, other: "Box") -> float:
        (ax, ay), (bx, by) = self.center, other.center
        return math.hypot(ax - bx, ay - by)

    def as_dict(self) -> dict:
        return {"x": round(self.x, 4), "y": round(self.y, 4), "w": round(self.w, 4), "h": round(self.h, 4)}


@dataclass
class Detection:
    box: Box
    conf: float
    hist: Optional[np.ndarray] = None  # colour histogram of the object, used to tell objects apart
    label: str = "door"  # what was detected: "door", "window", "chair", ... (kept last so Detection(box, conf, hist) still works)


@dataclass
class Observation:
    """One size reading of a door from one frame."""

    width_cm: float
    height_cm: float
    quality: float  # 0 to 1: how much to trust this reading
