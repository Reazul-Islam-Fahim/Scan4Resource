"""Image helpers: decoding uploads, cropping doors, colour histograms."""
from __future__ import annotations

import io
from typing import Optional

import numpy as np
from PIL import Image, ImageOps

from .types import Box

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_SIDE = 1600
HIST_BINS = 8 * 4 * 4  # hue x saturation x value


def decode_image(data: bytes) -> Image.Image:
    """Decode an uploaded JPEG/PNG into an RGB image. Raises ValueError if it is not an image."""
    if not data:
        raise ValueError("The uploaded frame is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("The uploaded frame is too large.")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:  # Pillow raises several different exception types
        raise ValueError("The uploaded frame is not a valid image.") from exc
    image = ImageOps.exif_transpose(image).convert("RGB")
    if max(image.size) > MAX_SIDE:
        image.thumbnail((MAX_SIDE, MAX_SIDE))
    return image


def crop_box(image: Image.Image, box: Box, pad: float = 0.0) -> Image.Image:
    """Crop a normalised box out of the image. `pad` grows (positive) or shrinks (negative) it."""
    w, h = image.size
    x0 = max(0.0, box.x - pad * box.w)
    y0 = max(0.0, box.y - pad * box.h)
    x1 = min(1.0, box.x1 + pad * box.w)
    y1 = min(1.0, box.y1 + pad * box.h)
    left, top = int(round(x0 * w)), int(round(y0 * h))
    right, bottom = max(left + 1, int(round(x1 * w))), max(top + 1, int(round(y1 * h)))
    return image.crop((left, top, min(w, right), min(h, bottom)))


def color_histogram(crop: Image.Image) -> np.ndarray:
    """Normalised HSV histogram of a (small copy of a) crop. Cheap and good enough to tell doors apart."""
    small = crop.resize((24, 48)).convert("HSV")
    a = np.asarray(small, dtype=np.int32)
    idx = (a[..., 0] * 8 // 256) * 16 + (a[..., 1] * 4 // 256) * 4 + (a[..., 2] * 4 // 256)
    hist = np.bincount(idx.ravel(), minlength=HIST_BINS).astype(np.float32)
    return hist / max(1.0, float(hist.sum()))


def hist_similarity(a: Optional[np.ndarray], b: Optional[np.ndarray]) -> float:
    """Histogram intersection, 0 (nothing in common) to 1 (identical). Neutral 0.5 when unknown."""
    if a is None or b is None:
        return 0.5
    return float(np.minimum(a, b).sum())
