"""Settings, read from environment variables so nothing is hard-coded."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _csv(name: str, default: tuple) -> tuple:
    """A comma-separated list from the environment, e.g. COCO_KEEP="sofa, bed"."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return tuple(part.strip().lower() for part in raw.split(",") if part.strip())


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

    # --- which detector ------------------------------------------------------------
    detector_backend: str = "imageai"  # "imageai" (custom model + COCO model) or "ultralytics" (the earlier YOLO detector)

    # --- ImageAI detector (used when detector_backend == "imageai") -------------------
    imageai_custom_model: str = "weights/imageai/custom.pt"  # your trained model (lamp, wardrobe, window, door, photo frame)
    imageai_custom_json: str = "weights/imageai/custom.json"  # the JSON that training wrote next to it
    imageai_custom_type: str = "yolov3"  # "yolov3" or "tiny-yolov3": must match how the custom model was trained
    coco_enabled: bool = True
    imageai_coco_model: str = "weights/imageai/yolov3.pt"  # ImageAI's pretrained COCO model
    imageai_coco_type: str = "yolov3"  # "yolov3" or "tiny-yolov3": must match the file above
    custom_conf: float = 0.5  # minimum confidence for the custom model (0 to 1)
    coco_conf: float = 0.5  # minimum confidence for the COCO model (ImageAI itself never goes below about 0.5 here)
    coco_keep: tuple = ()  # empty = report every COCO class; otherwise only these, in ImageAI's spelling
    overlap_iou: float = 0.7  # a COCO box and a custom box overlapping this much are the same object: keep the surer one
    measure_labels: tuple = ("door", "window")  # objects that get a width/height in cm
    material_labels: tuple = ("door",)  # objects whose material is guessed

    # --- ultralytics door detector (used when detector_backend == "ultralytics") ---
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
            detector_backend=_get("DETECTOR_BACKEND", cls.detector_backend).lower(),
            imageai_custom_model=_get("IMAGEAI_CUSTOM_MODEL", cls.imageai_custom_model),
            imageai_custom_json=_get("IMAGEAI_CUSTOM_JSON", cls.imageai_custom_json),
            imageai_custom_type=_get("IMAGEAI_CUSTOM_TYPE", cls.imageai_custom_type).lower(),
            coco_enabled=_get("COCO_ENABLED", cls.coco_enabled, bool),
            imageai_coco_model=_get("IMAGEAI_COCO_MODEL", cls.imageai_coco_model),
            imageai_coco_type=_get("IMAGEAI_COCO_TYPE", cls.imageai_coco_type).lower(),
            custom_conf=_get("CUSTOM_CONF", cls.custom_conf, float),
            coco_conf=_get("COCO_CONF", cls.coco_conf, float),
            coco_keep=_csv("COCO_KEEP", cls.coco_keep),
            overlap_iou=_get("OVERLAP_IOU", cls.overlap_iou, float),
            measure_labels=_csv("MEASURE_LABELS", cls.measure_labels),
            material_labels=_csv("MATERIAL_LABELS", cls.material_labels),
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