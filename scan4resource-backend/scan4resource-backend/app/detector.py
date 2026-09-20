"""Door detection with Ultralytics YOLO.

Default: YOLO-World, an open-vocabulary model, asked for "door" (works with no training, but is noisier).
Better: a YOLO model fine-tuned on doors (see scripts/train_door_detector.py). Point DETECTOR_WEIGHTS at it.
"""
from __future__ import annotations

import logging

from PIL import Image

from .config import Settings
from .types import Box, Detection

ACCEPTED_NAMES = {"door", "doors"}
log = logging.getLogger("uvicorn.error")  # shows up in the same console as the request lines


class YoloDoorDetector:
    def __init__(self, cfg: Settings):
        from ultralytics import YOLO, YOLOWorld

        self.cfg = cfg
        self.class_ids = None
        if cfg.detector_weights:
            self.model = YOLO(cfg.detector_weights)
            names = self.model.names  # {id: name}
            ids = [i for i, n in names.items() if str(n).lower() in ACCEPTED_NAMES]
            # A model with a single, differently named class is assumed to be a door model.
            self.class_ids = ids or (None if len(names) == 1 else [])
            if self.class_ids == []:
                raise ValueError(f"None of the classes {list(names.values())} is called 'door'.")
            self.source = f"fine-tuned model {cfg.detector_weights}"
        else:
            self.model = YOLOWorld(cfg.world_model)
            self.model.set_classes(["door"])
            self.source = f"zero-shot {cfg.world_model}"

    def detect(self, image: Image.Image) -> list[Detection]:
        cfg = self.cfg
        results = self.model.predict(
            image,
            conf=cfg.detect_conf,
            iou=cfg.detect_iou,
            imgsz=cfg.detect_imgsz,
            device=cfg.device or None,
            classes=self.class_ids,
            verbose=False,
        )
        detections: list[Detection] = []
        boxes = results[0].boxes if results else None
        if boxes is None or len(boxes) == 0:
            if cfg.log_detections:
                log.info("detector: no door box above confidence %.2f (try a lower DETECT_CONF)", cfg.detect_conf)
            return detections
        xyxyn = boxes.xyxyn.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        notes = []
        for (x0, y0, x1, y1), conf in zip(xyxyn, confs):
            x0, y0, x1, y1 = max(0.0, float(x0)), max(0.0, float(y0)), min(1.0, float(x1)), min(1.0, float(y1))
            box = Box(x0, y0, x1 - x0, y1 - y0)
            keep = box.h >= cfg.min_box_h and box.w >= cfg.min_box_w
            if keep:
                detections.append(Detection(box, float(conf)))
            notes.append(f"conf {float(conf):.2f}, {box.w:.2f} wide x {box.h:.2f} tall, "
                         + ("kept" if keep else "dropped: too small (MIN_BOX_H / MIN_BOX_W)"))
        if cfg.log_detections:
            log.info("detector: %d box(es): %s", len(notes), "; ".join(notes))
        return detections