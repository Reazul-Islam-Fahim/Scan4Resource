"""Door material from a photo of the door, with CLIP zero-shot classification (no training data needed)."""
from __future__ import annotations

from typing import Optional

import numpy as np
from PIL import Image

from .config import Settings

MATERIALS = ["wood", "metal", "glass", "pvc", "composite"]

PROMPTS = {
    "wood": [
        "a photo of a wooden door",
        "a door made of natural wood with visible wood grain",
        "a painted wooden interior door",
    ],
    "metal": ["a photo of a metal door", "a steel door", "an aluminium door"],
    "glass": ["a photo of a glass door", "a door made mostly of glass panels", "a glass sliding door"],
    "pvc": ["a photo of a white plastic PVC door", "a uPVC door"],
    "composite": ["a photo of a composite door", "a fibreglass door", "a laminate door"],
}


def _features(out, torch):
    """CLIP feature calls return a tensor in most transformers versions; newer ones may wrap it."""
    if isinstance(out, torch.Tensor):
        return out
    for attr in ("image_embeds", "text_embeds", "pooler_output"):
        value = getattr(out, attr, None)
        if value is not None:
            return value
    return out[0]


def pick_material(probs: Optional[np.ndarray], min_prob: float) -> str:
    """The most likely material, or 'unknown' when the classifier is not confident."""
    if probs is None:
        return "unknown"
    i = int(np.argmax(probs))
    return MATERIALS[i] if float(probs[i]) >= min_prob else "unknown"


class ClipMaterialClassifier:
    def __init__(self, cfg: Settings):
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self.torch = torch
        self.device = cfg.device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CLIPModel.from_pretrained(cfg.material_model).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(cfg.material_model)

        rows = []
        for material in MATERIALS:
            tokens = self.processor(text=PROMPTS[material], return_tensors="pt", padding=True).to(self.device)
            with torch.no_grad():
                emb = _features(self.model.get_text_features(**tokens), torch)
            emb = emb / emb.norm(dim=-1, keepdim=True)
            mean = emb.mean(dim=0)
            rows.append(mean / mean.norm())
        self.text = torch.stack(rows)  # (materials, dim)

    def classify(self, crops: list[Image.Image]) -> np.ndarray:
        """(N, len(MATERIALS)) probabilities."""
        if not crops:
            return np.zeros((0, len(MATERIALS)))
        torch = self.torch
        inputs = self.processor(images=crops, return_tensors="pt").to(self.device)
        with torch.no_grad():
            emb = _features(self.model.get_image_features(**inputs), torch)
            emb = emb / emb.norm(dim=-1, keepdim=True)
            probs = (100.0 * emb @ self.text.T).softmax(dim=-1)
        return probs.cpu().numpy()
