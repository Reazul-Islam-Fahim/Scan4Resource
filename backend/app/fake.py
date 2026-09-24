"""Stand-ins for the models, so the whole app can be tested without a GPU.

PIPELINE=fake runs these: doors drift into and out of view, then the loop repeats. It is meant for checking
that the frontend, the tunnel and the API are connected. It is NOT real detection.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from .material import MATERIALS
from .types import Box, Detection

_SCRIPT = [  # (first tick, last tick, box)
    (2, 9, Box(0.06, 0.14, 0.30, 0.72)),
    (12, 19, Box(0.62, 0.20, 0.30, 0.66)),
    (22, 29, Box(0.34, 0.12, 0.32, 0.76)),
]
_LOOP = 34


class FakeDetector:
    source = "simulated doors"

    def __init__(self):
        self.tick = 0

    def detect(self, image: Image.Image) -> list[Detection]:
        self.tick = (self.tick + 1) % _LOOP
        t = self.tick
        out = []
        for first, last, box in _SCRIPT:
            if first <= t <= last:
                drift = np.sin(t / 2) * 0.008
                out.append(Detection(Box(box.x + drift, box.y + drift / 2, box.w, box.h), 0.9))
        return out


class FakeMaterial:
    def classify(self, crops: list[Image.Image]) -> np.ndarray:
        probs = np.full((len(crops), len(MATERIALS)), 0.05)
        probs[:, 0] = 0.8  # wood
        return probs
