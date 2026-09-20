"""Door size in centimetres from one frame.

depth mode      A metric depth model gives the distance to the door; with the camera's focal length the
                door's edges in the image become real-world points, and width/height are the distances
                between them (so a door seen at an angle is still measured correctly).
reference mode  No depth: assumes the door is a standard height and takes the width from the box shape.
                Rough, but needs no model.

Both are estimates from a phone camera, not survey-grade. Calibrate DEPTH_SCALE against a tape measure.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image

from .config import Settings
from .types import Box, Observation

# A reading outside these ranges is not a door (or is a bad depth estimate): ignore it.
WIDTH_RANGE_CM = (45.0, 230.0)
HEIGHT_RANGE_CM = (160.0, 300.0)
MIN_FRONTAL = 0.6  # cosine of the angle between the camera axis and the door's normal


@dataclass
class FrameContext:
    width: int
    height: int
    depth: Optional[np.ndarray] = None  # metres, same size as the frame


def _strip_median(depth: np.ndarray, x0: float, x1: float, y0: float, y1: float) -> Optional[float]:
    h, w = depth.shape
    xi0, xi1 = int(max(0, math.floor(x0))), int(min(w, math.ceil(x1)))
    yi0, yi1 = int(max(0, math.floor(y0))), int(min(h, math.ceil(y1)))
    if xi1 - xi0 < 1 or yi1 - yi0 < 1:
        return None
    patch = depth[yi0:yi1, xi0:xi1]
    patch = patch[np.isfinite(patch) & (patch > 0.2)]
    if patch.size < 4:
        return None
    return float(np.median(patch))


def _extrapolate_inverse(z_a: float, p_a: float, z_b: float, p_b: float, at: float) -> float:
    """Depth at pixel position `at`, given depths at two positions along a row or column.

    For a flat surface, 1/depth changes linearly across the image, so extending that line to the edge of
    the door is exact for a plane and only mildly noise-sensitive.
    """
    slope = (1.0 / z_b - 1.0 / z_a) / (p_b - p_a)
    inv = 1.0 / z_a + slope * (at - p_a)
    return 1.0 / max(inv, 1e-3)


def size_from_depth(depth: np.ndarray, box: Box, f_px: float, scale: float = 1.0) -> Optional[Observation]:
    """Width and height of the door in `box`, or None if this frame cannot give a trustworthy reading."""
    H, W = depth.shape
    x0, y0, x1, y1 = box.x * W, box.y * H, box.x1 * W, box.y1 * H
    bw, bh = x1 - x0, y1 - y0
    if bw < 8 or bh < 16:
        return None
    # A door cut off by the edge of the frame would be measured too small.
    if x0 < 0.01 * W or y0 < 0.01 * H or x1 > 0.99 * W or y1 > 0.99 * H:
        return None

    inset = 0.08  # sample just inside the box edges, where the door surface is
    sw, sh = max(2.0, 0.04 * bw), max(2.0, 0.04 * bh)
    ym = (y0 + y1) / 2
    xa, xb = x0 + inset * bw, x1 - inset * bw  # left / right sampling columns
    ya, yb_ = y0 + inset * bh, y1 - inset * bh  # top / bottom sampling rows

    # Width: depth at the left and right edges (measured just inside, then extended to the edge).
    zl = _strip_median(depth, xa - sw, xa + sw, ym - 0.2 * bh, ym + 0.2 * bh)
    zr = _strip_median(depth, xb - sw, xb + sw, ym - 0.2 * bh, ym + 0.2 * bh)
    if zl is None or zr is None:
        return None
    zl_edge = _extrapolate_inverse(zl, xa, zr, xb, x0)
    zr_edge = _extrapolate_inverse(zl, xa, zr, xb, x1)

    cx, cy = W / 2, H / 2
    p_left = np.array([(x0 - cx) * zl_edge / f_px, zl_edge])
    p_right = np.array([(x1 - cx) * zr_edge / f_px, zr_edge])
    width_m = float(np.linalg.norm(p_right - p_left))
    frontal = math.cos(math.atan2(abs(p_right[1] - p_left[1]), max(abs(p_right[0] - p_left[0]), 1e-6)))
    if frontal < MIN_FRONTAL:
        return None

    # Height: on the edge nearest the camera, because that is the edge that sets the box's top and bottom
    # when the door is turned. Measure top and bottom there, extended to the box's top and bottom.
    near_col, u_near = (xa, x0) if zl_edge <= zr_edge else (xb, x1)
    zt = _strip_median(depth, near_col - sw, near_col + sw, ya - sh, ya + sh)
    zb = _strip_median(depth, near_col - sw, near_col + sw, yb_ - sh, yb_ + sh)
    if zt is None or zb is None:
        return None
    zt_edge = _extrapolate_inverse(zt, ya, zb, yb_, y0)
    zb_edge = _extrapolate_inverse(zt, ya, zb, yb_, y1)
    p_top = np.array([(u_near - cx) * zt_edge / f_px, (y0 - cy) * zt_edge / f_px, zt_edge])
    p_bottom = np.array([(u_near - cx) * zb_edge / f_px, (y1 - cy) * zb_edge / f_px, zb_edge])
    height_m = float(np.linalg.norm(p_bottom - p_top))

    width_cm, height_cm = width_m * 100 * scale, height_m * 100 * scale
    if not (WIDTH_RANGE_CM[0] <= width_cm <= WIDTH_RANGE_CM[1] and HEIGHT_RANGE_CM[0] <= height_cm <= HEIGHT_RANGE_CM[1]):
        return None

    quality = frontal**2 * min(1.0, 0.35 + bh / H)  # bigger, more frontal doors give better readings
    return Observation(width_cm, height_cm, quality)


def size_from_reference(box: Box, frame_w: int, frame_h: int, reference_height_cm: float) -> Optional[Observation]:
    """Assume a standard height and scale the width by the box's proportions."""
    if box.x < 0.01 or box.y < 0.01 or box.x1 > 0.99 or box.y1 > 0.99:
        return None
    bw_px, bh_px = box.w * frame_w, box.h * frame_h
    if bh_px < 16 or bw_px < 8:
        return None
    return Observation(reference_height_cm * bw_px / bh_px, reference_height_cm, 0.3)


# --------------------------------------------------------------------------- measurers
class ReferenceMeasurer:
    """No model needed."""

    name = "reference"

    def __init__(self, cfg: Settings):
        self.cfg = cfg

    def prepare(self, image: Image.Image) -> FrameContext:
        return FrameContext(image.width, image.height)

    def measure(self, ctx: FrameContext, box: Box) -> Optional[Observation]:
        return size_from_reference(box, ctx.width, ctx.height, self.cfg.reference_height_cm)


class DepthMeasurer:
    """Metric depth with Depth Anything V2 (indoor model, outputs metres)."""

    name = "depth"

    def __init__(self, cfg: Settings):
        import torch
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation

        self.cfg = cfg
        self.torch = torch
        self.device = cfg.device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = AutoImageProcessor.from_pretrained(cfg.depth_model)
        self.model = AutoModelForDepthEstimation.from_pretrained(cfg.depth_model).to(self.device).eval()

    def prepare(self, image: Image.Image) -> FrameContext:
        torch = self.torch
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            predicted = self.model(**inputs).predicted_depth  # (1, h, w) in metres
            depth = torch.nn.functional.interpolate(
                predicted.unsqueeze(1), size=(image.height, image.width), mode="bicubic", align_corners=False
            )
        return FrameContext(image.width, image.height, depth[0, 0].float().cpu().numpy())

    def measure(self, ctx: FrameContext, box: Box) -> Optional[Observation]:
        if ctx.depth is None:
            return None
        f_px = self.cfg.focal_ratio * max(ctx.width, ctx.height)
        return size_from_depth(ctx.depth, box, f_px, self.cfg.depth_scale)
