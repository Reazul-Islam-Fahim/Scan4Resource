"""One frame in, the doors in it out: detect, track, measure, classify material."""
from __future__ import annotations

import logging
import threading
import time
from typing import Optional

from PIL import Image

from .config import Settings
from .imaging import color_histogram, crop_box
from .material import pick_material
from .tracker import TrackerStore
from .types import Detection

log = logging.getLogger("uvicorn.error")


class Pipeline:
    def __init__(self, cfg: Settings, detector, measurer, material):
        self.cfg = cfg
        self.detector = detector
        self.measurer = measurer
        self.material = material
        self.trackers = TrackerStore(cfg)
        self._lock = threading.Lock()  # one frame at a time: the models are not thread-safe

    def describe(self) -> dict:
        return {
            "detector": getattr(self.detector, "source", type(self.detector).__name__),
            "measure_mode": getattr(self.measurer, "name", type(self.measurer).__name__),
            "material": type(self.material).__name__,
        }

    def process(self, image: Image.Image, session_id: str, now: Optional[float] = None) -> list[dict]:
        """The doors visible in this frame, each with a stable id and its best size/material so far."""
        now = time.monotonic() if now is None else now
        with self._lock:
            detections = self.detector.detect(image)
            for det in detections:
                det.hist = color_histogram(crop_box(image, det.box))

            tracker = self.trackers.get(session_id, now)
            with tracker.lock:
                matched = tracker.update(detections, now)
                if not matched:
                    if self.cfg.log_detections:
                        log.info("tracker: nothing to report (no door boxes in this frame)")
                    return []

                ctx = self.measurer.prepare(image)
                to_classify: list[tuple] = []
                for track, det in matched:
                    track.add_observation(self.measurer.measure(ctx, det.box))
                    if track.material_obs < self.cfg.material_max_obs:
                        to_classify.append((track, det, crop_box(image, det.box, pad=-0.05)))

                if to_classify:
                    probs = self.material.classify([crop for _, _, crop in to_classify])
                    for (track, det, _), p in zip(to_classify, probs):
                        track.add_material(p, det.conf)

                views = [self._view(track, det) for track, det in matched if track.confirmed(self.cfg.min_hits)]
                if self.cfg.log_detections:
                    log.info("tracker: %d door(s) in view, %d reported (a door needs %d sightings first)",
                             len(matched), len(views), self.cfg.min_hits)
                return views

    def _view(self, track, det: Detection) -> dict:
        width, height = track.size_cm()
        return {
            "id": track.id,
            "box": det.box.as_dict(),
            "width_cm": width,
            "height_cm": height,
            "material": pick_material(track.material_probs(), self.cfg.material_min_prob),
            "confidence": track.confidence(),
        }


def build_pipeline(cfg: Settings) -> Pipeline:
    """Create the components named by the settings. Models are downloaded on first use."""
    if cfg.pipeline == "fake":
        from .fake import FakeDetector, FakeMaterial
        from .measure import ReferenceMeasurer

        return Pipeline(cfg, FakeDetector(), ReferenceMeasurer(cfg), FakeMaterial())

    from .detector import YoloDoorDetector
    from .material import ClipMaterialClassifier

    detector = YoloDoorDetector(cfg)
    if cfg.measure_mode == "reference":
        from .measure import ReferenceMeasurer

        measurer = ReferenceMeasurer(cfg)
    else:
        from .measure import DepthMeasurer

        measurer = DepthMeasurer(cfg)
    return Pipeline(cfg, detector, measurer, ClipMaterialClassifier(cfg))