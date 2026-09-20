"""Settings, read from environment variables so nothing is hard-coded."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _get(name: str, default, cast=str):
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    raw = raw.strip()
    if cast is bool:
        return raw.lower() in {"1", "true", "yes", "on"}
    return cast(raw)


@dataclass(frozen=True)
class Settings:
    # --- which components to run -------------------------------------------------
    pipeline: str = "real"  # "real" = YOLO + depth + CLIP; "fake" = simulated doors (connectivity test)

    # --- door detector -----------------------------------------------------------
    detector_weights: str = ""  # path to a fine-tuned door model (.pt); empty = zero-shot YOLO-World
    world_model: str = "yolov8s-worldv2.pt"
    detect_conf: float = 0.35
    detect_iou: float = 0.5
    detect_imgsz: int = 640
    min_box_h: float = 0.20  # ignore boxes shorter than this fraction of the frame height
    min_box_w: float = 0.04
    device: str = ""  # "" = automatic (GPU if available)

    # --- tracking (count each door once) ------------------------------------------
    min_hits: int = 2  # a door is reported only after it was seen in this many frames
    max_gap_s: float = 2.0  # a door not seen for this long can no longer be matched by position
    match_iou: float = 0.25
    match_dist: float = 0.25  # max centre distance (fraction of the frame) for appearance matching
    reid: bool = False  # re-identify a door that left the view and returned (by colour); see README
    reid_sim: float = 0.85
    session_ttl_s: int = 7200

    # --- measurement --------------------------------------------------------------
    measure_mode: str = "depth"  # "depth" (metric depth model) or "reference" (assume a standard door height)
    depth_model: str = "depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf"
    focal_ratio: float = 0.75  # focal length / long side of the image (about 0.75 for a phone's main camera)
    depth_scale: float = 1.0  # multiplier to calibrate against a tape measure
    reference_height_cm: float = 205.0

    # --- material -----------------------------------------------------------------
    material_model: str = "openai/clip-vit-base-patch32"
    material_min_prob: float = 0.35
    material_max_obs: int = 6  # classify each door in at most this many frames

    # --- server ---------------------------------------------------------------------
    allowed_origins: tuple = ("*",)
    db_path: str = "data/scans.db"
    log_detections: bool = False  # print what the detector and tracker did with every frame (LOG_DETECTIONS=1)

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(o.strip() for o in _get("ALLOWED_ORIGINS", "*").split(",") if o.strip())
        return cls(
            pipeline=_get("PIPELINE", cls.pipeline).lower(),
            detector_weights=_get("DETECTOR_WEIGHTS", cls.detector_weights),
            world_model=_get("WORLD_MODEL", cls.world_model),
            detect_conf=_get("DETECT_CONF", cls.detect_conf, float),
            detect_iou=_get("DETECT_IOU", cls.detect_iou, float),
            detect_imgsz=_get("DETECT_IMGSZ", cls.detect_imgsz, int),
            min_box_h=_get("MIN_BOX_H", cls.min_box_h, float),
            min_box_w=_get("MIN_BOX_W", cls.min_box_w, float),
            device=_get("DEVICE", cls.device),
            min_hits=_get("MIN_HITS", cls.min_hits, int),
            max_gap_s=_get("MAX_GAP_S", cls.max_gap_s, float),
            match_iou=_get("MATCH_IOU", cls.match_iou, float),
            match_dist=_get("MATCH_DIST", cls.match_dist, float),
            reid=_get("REID", cls.reid, bool),
            reid_sim=_get("REID_SIM", cls.reid_sim, float),
            session_ttl_s=_get("SESSION_TTL_S", cls.session_ttl_s, int),
            measure_mode=_get("MEASURE_MODE", cls.measure_mode).lower(),
            depth_model=_get("DEPTH_MODEL", cls.depth_model),
            focal_ratio=_get("FOCAL_RATIO", cls.focal_ratio, float),
            depth_scale=_get("DEPTH_SCALE", cls.depth_scale, float),
            reference_height_cm=_get("REFERENCE_HEIGHT_CM", cls.reference_height_cm, float),
            material_model=_get("MATERIAL_MODEL", cls.material_model),
            material_min_prob=_get("MATERIAL_MIN_PROB", cls.material_min_prob, float),
            material_max_obs=_get("MATERIAL_MAX_OBS", cls.material_max_obs, int),
            allowed_origins=origins or ("*",),
            db_path=_get("DB_PATH", cls.db_path),
            log_detections=_get("LOG_DETECTIONS", cls.log_detections, bool),
        )