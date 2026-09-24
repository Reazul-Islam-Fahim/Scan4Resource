"""Detection with ImageAI: your custom-trained model plus ImageAI's pretrained COCO model.

    custom model  -> the classes COCO does not have (lamp, wardrobe, window, door, photo frame)
    COCO model    -> everyday objects (chair, sofa, bed, tvmonitor, laptop, pottedplant, sink, ...)

The two models cover different classes, so their answers do not repeat each other. If a COCO box and a
custom box still land on the same object (for example a photo frame that COCO takes for a screen), only the
more confident one is kept.

Every result is a Detection with a label, a box in 0..1 image coordinates and a confidence in 0..1, exactly
what the tracker, the depth measurement and the API already expect.

Facts about ImageAI 3.x that this file relies on (checked in its source):
  * arrays passed in must be BGR (OpenCV order); ImageAI flips them to RGB itself. Pillow images are RGB,
    so they are flipped here first. Passing RGB unchanged would swap red and blue and lower accuracy.
  * results are dicts: {"name", "percentage_probability" (0-100), "box_points": [x1, y1, x2, y2]} in pixels.
  * with output_type="file" and no output path, nothing is written to disk.
  * `import imageai.Detection` needs torch, torchvision, opencv, scipy, tqdm and tkinter installed.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np
from PIL import Image

from .config import Settings
from .types import Box, Detection

log = logging.getLogger("uvicorn.error")

MIN_BOX_OTHER = 0.01  # boxes narrower/shorter than this (fraction of the frame) are noise for any non-door object

# A few of ImageAI's 80 COCO class names run words together (checked in its coco_classes.txt); everything
# else in that file already reads fine (e.g. "cell phone", "fire hydrant") and needs no entry here.
COCO_DISPLAY_NAMES = {
    "pottedplant": "potted plant",
    "diningtable": "dining table",
    "tvmonitor": "tv",
}


def _require_file(path: str, setting: str, hint: str = "") -> None:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"{setting}: no file at '{path}'. {hint}".strip())


def _set_type(model, kind: str) -> None:
    if kind == "yolov3":
        model.setModelTypeAsYOLOv3()
    elif kind in ("tiny-yolov3", "tinyyolov3"):
        model.setModelTypeAsTinyYOLOv3()
    else:
        raise ValueError(f"Model type '{kind}' is not supported. Use 'yolov3' or 'tiny-yolov3'.")


def _import_imageai():
    try:
        from imageai.Detection import ObjectDetection
        from imageai.Detection.Custom import CustomObjectDetection
    except ImportError as exc:  # tkinter is the one people forget on a server
        raise RuntimeError(
            f"ImageAI could not be imported ({exc}). It needs: pip install imageai torch torchvision "
            "opencv-python-headless scipy tqdm, and tkinter (on Debian/Ubuntu: apt install python3-tk)."
        ) from exc
    return ObjectDetection, CustomObjectDetection


def to_bgr(image: Image.Image) -> np.ndarray:
    """Pillow RGB image -> contiguous BGR array, which is what ImageAI expects."""
    return np.ascontiguousarray(np.asarray(image.convert("RGB"))[:, :, ::-1])


class ImageAIDetector:
    def __init__(self, cfg: Settings, custom=None, coco=None, *, load: bool = True):
        """`load=False` lets tests hand in ready-made models instead of loading weights."""
        self.cfg = cfg
        if load:
            custom = self._load_custom(cfg)
            coco = self._load_coco(cfg) if cfg.coco_enabled else None
        self.custom = custom
        self.coco = coco
        self.source = "ImageAI: " + " + ".join(
            part
            for part in (
                f"custom model {cfg.imageai_custom_model}" if custom is not None else "",
                f"COCO model {cfg.imageai_coco_model}" if coco is not None else "",
            )
            if part
        )

    # ---- loading -------------------------------------------------------------------
    @staticmethod
    def _load_custom(cfg: Settings):
        _require_file(cfg.imageai_custom_model, "IMAGEAI_CUSTOM_MODEL",
                      "Train one with scripts/train_imageai_detector.py, or point the setting at your .pt file.")
        _require_file(cfg.imageai_custom_json, "IMAGEAI_CUSTOM_JSON",
                      "Training writes it next to the model (the *_detection_config.json file).")
        _, CustomObjectDetection = _import_imageai()
        model = CustomObjectDetection()
        _set_type(model, cfg.imageai_custom_type)
        model.setModelPath(cfg.imageai_custom_model)
        model.setJsonPath(cfg.imageai_custom_json)
        if cfg.device == "cpu":
            model.useCPU()
        model.loadModel()
        return model

    @staticmethod
    def _load_coco(cfg: Settings):
        _require_file(cfg.imageai_coco_model, "IMAGEAI_COCO_MODEL",
                      "Download yolov3.pt from the ImageAI '3.0.0-pretrained' release (scripts/train_imageai_detector.py "
                      "does it for you), or set COCO_ENABLED=false.")
        ObjectDetection, _ = _import_imageai()
        model = ObjectDetection()
        _set_type(model, cfg.imageai_coco_type)
        model.setModelPath(cfg.imageai_coco_model)
        if cfg.device == "cpu":
            model.useCPU()
        model.loadModel()
        return model

    # ---- detection -------------------------------------------------------------------
    def detect(self, image: Image.Image) -> list[Detection]:
        cfg = self.cfg
        width, height = image.size
        frame = to_bgr(image)

        candidates: list[tuple[Detection, str]] = []  # (detection, which model found it)
        if self.custom is not None:
            raw = self.custom.detectObjectsFromImage(
                input_image=frame,
                output_type="file",
                minimum_percentage_probability=int(round(cfg.custom_conf * 100)),
            )
            candidates += self._convert(raw, width, height, "custom")
        if self.coco is not None:
            raw = self.coco.detectObjectsFromImage(
                input_image=frame,
                output_type="file",
                minimum_percentage_probability=int(round(cfg.coco_conf * 100)),
            )
            candidates += self._convert(raw, width, height, "coco")

        detections = self._merge(candidates)
        if cfg.log_detections:
            log.info("detector: %s", "; ".join(f"{d.label} {d.conf:.2f}" for d in detections) or "nothing above the confidence limits")
        return detections

    def _convert(self, raw: list, width: int, height: int, source: str) -> list[tuple[Detection, str]]:
        cfg = self.cfg
        out: list[tuple[Detection, str]] = []
        keep = set(cfg.coco_keep)
        for item in raw or []:
            label = str(item["name"]).strip().lower()
            if source == "coco" and keep and label not in keep:
                continue
            if source == "coco":
                label = COCO_DISPLAY_NAMES.get(label, label)
            x1, y1, x2, y2 = item["box_points"]
            x0, y0 = min(max(x1 / width, 0.0), 1.0), min(max(y1 / height, 0.0), 1.0)
            x1n, y1n = min(max(x2 / width, 0.0), 1.0), min(max(y2 / height, 0.0), 1.0)
            box = Box(x0, y0, x1n - x0, y1n - y0)
            if box.w <= 0 or box.h <= 0:
                continue
            min_w, min_h = (cfg.min_box_w, cfg.min_box_h) if label == "door" else (MIN_BOX_OTHER, MIN_BOX_OTHER)
            if box.w < min_w or box.h < min_h:
                continue
            out.append((Detection(box, float(item["percentage_probability"]) / 100.0, label=label), source))
        return out

    def _merge(self, candidates: list[tuple[Detection, str]]) -> list[Detection]:
        """Sure ones first; drop a box that sits on top of an already kept box from the *other* model."""
        kept: list[tuple[Detection, str]] = []
        for det, source in sorted(candidates, key=lambda c: c[0].conf, reverse=True):
            clash = any(k_source != source and det.box.iou(k.box) >= self.cfg.overlap_iou for k, k_source in kept)
            if not clash:
                kept.append((det, source))
        return [det for det, _ in kept]
