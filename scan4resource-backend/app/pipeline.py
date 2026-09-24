"""One frame in, the objects in it out: detect, track, measure, classify material."""
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
        """The doors visible in this frame (what the frontend has always received)."""
        return self.process_frame(image, session_id, now)["doors"]

    def process_frame(self, image: Image.Image, session_id: str, now: Optional[float] = None) -> dict:
        """{"doors": [...], "objects": [...]}: every confirmed object in this frame, each with a stable id.

        Doors keep the fields the frontend already reads. Everything else (window, chair, lamp, ...) goes in
        `objects` with a `label`. Only labels in `measure_labels` get a size; only `material_labels` get a material."""
        cfg = self.cfg
        now = time.monotonic() if now is None else now
        empty = {"doors": [], "objects": []}
        with self._lock:
            detections = self.detector.detect(image)
            for det in detections:
                det.hist = color_histogram(crop_box(image, det.box))

            tracker = self.trackers.get(session_id, now)
            with tracker.lock:
                matched = tracker.update(detections, now)
                if not matched:
                    if cfg.log_detections:
                        log.info("tracker: nothing to report (no boxes in this frame)")
                    return empty

                # The depth model is the slow part: run it only when something in view needs a size.
                needs_size = any(det.label in cfg.measure_labels for _, det in matched)
                ctx = self.measurer.prepare(image) if needs_size else None
                to_classify: list[tuple] = []
                for track, det in matched:
                    if det.label in cfg.measure_labels:
                        track.add_observation(self.measurer.measure(ctx, det.box, det.label))
                    if det.label in cfg.material_labels and track.material_obs < cfg.material_max_obs:
                        to_classify.append((track, det, crop_box(image, det.box, pad=-0.05)))

                if to_classify:
                    probs = self.material.classify([crop for _, _, crop in to_classify])
                    for (track, det, _), p in zip(to_classify, probs):
                        track.add_material(p, det.conf)

                doors, objects = [], []
                for track, det in matched:
                    if not track.confirmed(cfg.min_hits):
                        continue
                    view = self._view(track, det)
                    (doors if det.label == "door" else objects).append(view)
                if cfg.log_detections:
                    log.info("tracker: %d in view, %d door(s) and %d other object(s) reported (a new object needs %d sightings)",
                             len(matched), len(doors), len(objects), cfg.min_hits)
                return {"doors": doors, "objects": objects}

    def _view(self, track, det: Detection) -> dict:
        cfg = self.cfg
        width, height = track.size_cm()
        measured = det.label in cfg.measure_labels
        view = {
            "id": track.id,
            "box": det.box.as_dict(),
            "width_cm": width,
            "height_cm": height,
            "material": pick_material(track.material_probs(), cfg.material_min_prob),
            # track.confidence() grows with good size readings, which objects without a size never get:
            # for those, report the detector's own (smoothed) confidence.
            "confidence": track.confidence() if measured else round(track.conf, 3),
        }
        if det.label == "door":
            return view  # exactly the fields the frontend already reads
        view["label"] = det.label
        if det.label not in cfg.material_labels:
            view["material"] = None
        return view


def build_pipeline(cfg: Settings) -> Pipeline:
    """Create the components named by the settings. Models are downloaded on first use."""
    if cfg.pipeline == "fake":
        from .fake import FakeDetector, FakeMaterial
        from .measure import ReferenceMeasurer

        return Pipeline(cfg, FakeDetector(), ReferenceMeasurer(cfg), FakeMaterial())

    from .material import ClipMaterialClassifier

    if cfg.detector_backend == "imageai":
        from .imageai_detector import ImageAIDetector

        detector = ImageAIDetector(cfg)
    elif cfg.detector_backend == "ultralytics":
        from .detector import YoloDoorDetector

        detector = YoloDoorDetector(cfg)
    else:
        raise ValueError(f"DETECTOR_BACKEND must be 'imageai' or 'ultralytics', not '{cfg.detector_backend}'.")

    if cfg.measure_mode == "reference":
        from .measure import ReferenceMeasurer

        measurer = ReferenceMeasurer(cfg)
    else:
        from .measure import DepthMeasurer

        measurer = DepthMeasurer(cfg)
    return Pipeline(cfg, detector, measurer, ClipMaterialClassifier(cfg))
