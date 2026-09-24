"""The ImageAI detector, tested with stand-in models (no weights, no torch needed).

The stand-ins copy ImageAI 3.x's real interface: detectObjectsFromImage(...) returns a list of
{"name", "percentage_probability" (0-100), "box_points": [x1, y1, x2, y2] in pixels}.
"""
import sys
import types

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.imageai_detector import ImageAIDetector, to_bgr
from app.main import create_app
from app.material import MATERIALS
from app.measure import LABEL_RANGES, ReferenceMeasurer, size_from_depth
from app.pipeline import Pipeline
from tests.conftest import make_jpeg
from tests.test_measure import F, scene


class StubModel:
    def __init__(self, results):
        self.results = results
        self.calls = []

    def detectObjectsFromImage(self, input_image, **kwargs):
        self.calls.append((input_image, kwargs))
        return list(self.results)


def hit(name, pct, box):
    return {"name": name, "percentage_probability": pct, "box_points": list(box)}


def cfg(**kw):
    return Settings(db_path=":memory:", pipeline="real", **kw)


def detector(custom=(), coco=(), **kw):
    return ImageAIDetector(cfg(**kw), custom=StubModel(custom), coco=StubModel(coco), load=False)


IMG = Image.new("RGB", (400, 200), (200, 100, 50))


# ---- what goes into ImageAI -----------------------------------------------------------------
def test_pillow_rgb_is_flipped_to_bgr_and_contiguous():
    arr = to_bgr(IMG)
    assert arr.shape == (200, 400, 3) and arr.flags["C_CONTIGUOUS"]
    assert tuple(arr[0, 0]) == (50, 100, 200)  # B, G, R


def test_confidence_limits_are_sent_as_whole_percentages_and_nothing_is_written_to_disk():
    d = detector(custom_conf=0.55, coco_conf=0.6)
    d.detect(IMG)
    (_, custom_kw), (_, coco_kw) = d.custom.calls[0], d.coco.calls[0]
    assert custom_kw["minimum_percentage_probability"] == 55 and coco_kw["minimum_percentage_probability"] == 60
    assert custom_kw["output_type"] == "file" and "output_image_path" not in custom_kw


# ---- what comes out ------------------------------------------------------------------------------
def test_pixel_boxes_become_normalised_boxes_and_percentages_become_fractions():
    d = detector(custom=[hit("window", 91.5, (40, 20, 200, 180))])
    (det,) = d.detect(IMG)
    assert det.label == "window" and det.conf == pytest.approx(0.915)
    assert (det.box.x, det.box.y, det.box.w, det.box.h) == pytest.approx((0.1, 0.1, 0.4, 0.8))


def test_boxes_are_clamped_to_the_frame():
    (det,) = detector(custom=[hit("window", 90, (-10, -5, 500, 260))]).detect(IMG)
    assert (det.box.x, det.box.y, det.box.x1, det.box.y1) == (0.0, 0.0, 1.0, 1.0)


def test_small_boxes_are_dropped_for_doors_but_not_for_other_objects():
    small = (10, 10, 30, 30)  # 5% wide, 10% tall: too short for a door, fine for a lamp
    out = detector(custom=[hit("door", 90, small), hit("lamp", 90, small)]).detect(IMG)
    assert [d.label for d in out] == ["lamp"]


def test_coco_names_with_no_spaces_are_shown_readably():
    out = detector(coco=[hit("tvmonitor", 80, (0, 0, 200, 100)), hit("pottedplant", 70, (250, 20, 350, 150))]).detect(IMG)
    assert {d.label for d in out} == {"tv", "potted plant"}


def test_most_coco_names_pass_through_unchanged():
    out = detector(coco=[hit("cell phone", 80, (0, 0, 200, 100)), hit("fire hydrant", 70, (250, 20, 350, 150))]).detect(IMG)
    assert {d.label for d in out} == {"cell phone", "fire hydrant"}


def test_coco_keep_limits_what_coco_reports_but_not_the_custom_model():
    out = detector(custom=[hit("door", 90, (100, 10, 220, 190))],
                   coco=[hit("chair", 90, (0, 100, 60, 190)), hit("sink", 90, (300, 100, 390, 190))],
                   coco_keep=("sink",)).detect(IMG)
    assert {d.label for d in out} == {"door", "sink"}


def test_the_same_object_from_both_models_is_reported_once_keeping_the_surer_answer():
    frame = (100, 20, 300, 180)
    out = detector(custom=[hit("photo frame", 72, frame)], coco=[hit("tvmonitor", 88, (102, 22, 298, 178))]).detect(IMG)
    assert [(d.label, round(d.conf, 2)) for d in out] == [("tv", 0.88)]


def test_different_objects_from_the_two_models_are_all_kept():
    out = detector(custom=[hit("window", 80, (10, 10, 120, 150))], coco=[hit("chair", 85, (200, 80, 380, 190))]).detect(IMG)
    assert {d.label for d in out} == {"window", "chair"}


def test_two_labels_from_the_same_model_are_never_merged():
    box = (100, 20, 300, 180)
    out = detector(custom=[hit("door", 80, box), hit("window", 75, box)]).detect(IMG)
    assert {d.label for d in out} == {"door", "window"}


def test_coco_can_be_switched_off():
    d = ImageAIDetector(cfg(), custom=StubModel([hit("lamp", 90, (10, 10, 60, 90))]), coco=None, load=False)
    assert [x.label for x in d.detect(IMG)] == ["lamp"] and "COCO" not in d.source


# ---- loading, with a stand-in for the ImageAI package ---------------------------------------------
def test_missing_weights_give_a_message_that_names_the_setting(tmp_path):
    with pytest.raises(FileNotFoundError, match="IMAGEAI_CUSTOM_MODEL"):
        ImageAIDetector(cfg(imageai_custom_model=str(tmp_path / "nope.pt")))


def test_models_are_set_up_with_the_calls_imageai_documents(tmp_path, monkeypatch):
    log = []

    class Fake:
        def __init__(self, name):
            self.name = name

        def __getattr__(self, method):
            return lambda *a, **k: log.append((self.name, method, a))

    pkg = types.ModuleType("imageai")
    det = types.ModuleType("imageai.Detection")
    cus = types.ModuleType("imageai.Detection.Custom")
    det.ObjectDetection = lambda: Fake("coco")
    cus.CustomObjectDetection = lambda: Fake("custom")
    for name, mod in (("imageai", pkg), ("imageai.Detection", det), ("imageai.Detection.Custom", cus)):
        monkeypatch.setitem(sys.modules, name, mod)

    files = {n: tmp_path / n for n in ("custom.pt", "custom.json", "yolov3.pt")}
    for f in files.values():
        f.write_bytes(b"x")
    d = ImageAIDetector(cfg(imageai_custom_model=str(files["custom.pt"]), imageai_custom_json=str(files["custom.json"]),
                            imageai_coco_model=str(files["yolov3.pt"]), imageai_custom_type="tiny-yolov3"))
    assert ("custom", "setModelTypeAsTinyYOLOv3", ()) in log and ("coco", "setModelTypeAsYOLOv3", ()) in log
    assert ("custom", "setJsonPath", (str(files["custom.json"]),)) in log
    assert [c[1] for c in log if c[0] == "custom"][-1] == "loadModel" and [c[1] for c in log if c[0] == "coco"][-1] == "loadModel"
    assert "custom model" in d.source and "COCO model" in d.source


def test_settings_parse_lists_and_switches_from_the_environment(monkeypatch):
    monkeypatch.setenv("COCO_KEEP", "Sofa, bed ,diningtable")
    monkeypatch.setenv("COCO_ENABLED", "false")
    monkeypatch.setenv("DETECTOR_BACKEND", "ImageAI")
    s = Settings.from_env()
    assert s.coco_keep == ("sofa", "bed", "diningtable") and s.coco_enabled is False and s.detector_backend == "imageai"


# ---- windows are measured with their own size limits -----------------------------------------------
def test_a_window_gets_a_size_where_the_door_limits_would_reject_it():
    depth, box = scene(door_w=1.2, door_h=1.2)  # a 1.2 m x 1.2 m plane 3 m away
    assert size_from_depth(depth, box, F) is None  # not a door
    obs = size_from_depth(depth, box, F, ranges=LABEL_RANGES["window"])
    assert obs is not None and abs(obs.width_cm - 120) < 4 and abs(obs.height_cm - 120) < 4


# ---- through the pipeline and the API ---------------------------------------------------------------
class ScriptedLabelled:
    source = "scripted"

    def __init__(self, frames):
        self.frames, self.i = frames, 0

    def detect(self, image):
        from app.types import Box, Detection

        items = self.frames[min(self.i, len(self.frames) - 1)]
        self.i += 1
        return [Detection(Box(*b), c, label=label) for label, b, c in items]


class WoodMaterial:
    def classify(self, crops):
        probs = np.full((len(crops), len(MATERIALS)), 0.05)
        probs[:, 0] = 0.8
        return probs


DOOR = ("door", (0.30, 0.12, 0.30, 0.76), 0.9)
CHAIR = ("chair", (0.70, 0.55, 0.20, 0.35), 0.8)
WINDOW = ("window", (0.05, 0.10, 0.20, 0.30), 0.85)


def api_client(frames):
    c = Settings(db_path=":memory:", pipeline="fake", min_hits=2)
    return TestClient(create_app(c, Pipeline(c, ScriptedLabelled(frames), ReferenceMeasurer(c), WoodMaterial())))


def test_detect_returns_doors_unchanged_and_everything_else_under_objects():
    frames = [[DOOR, CHAIR, WINDOW]] * 3
    with api_client(frames) as c:
        bodies = [c.post("/detect", files={"frame": ("f.jpg", make_jpeg(), "image/jpeg")}, data={"scan_id": "s"}).json()
                  for _ in range(3)]
    assert bodies[0] == {"doors": [], "objects": []}  # nothing is reported after one sighting
    door = bodies[1]["doors"][0]
    assert set(door) == {"id", "box", "width_cm", "height_cm", "material", "confidence"}  # the contract the frontend reads
    objects = {o["label"]: o for o in bodies[1]["objects"]}
    assert set(objects) == {"chair", "window"}
    assert objects["chair"]["id"] == "chair-1" and objects["window"]["id"] == "window-1"
    assert objects["chair"]["width_cm"] is None and objects["chair"]["material"] is None
    assert objects["chair"]["confidence"] == pytest.approx(0.8, abs=0.01)  # the detector's own confidence, not halved


def test_a_door_and_a_window_on_top_of_each_other_are_tracked_separately():
    overlapping = [("door", (0.30, 0.12, 0.30, 0.76), 0.9), ("window", (0.31, 0.13, 0.29, 0.74), 0.8)]
    with api_client([overlapping] * 3) as c:
        for _ in range(3):
            body = c.post("/detect", files={"frame": ("f.jpg", make_jpeg(), "image/jpeg")}, data={"scan_id": "s"}).json()
    assert [d["id"] for d in body["doors"]] == ["door-1"] and [o["id"] for o in body["objects"]] == ["window-1"]
