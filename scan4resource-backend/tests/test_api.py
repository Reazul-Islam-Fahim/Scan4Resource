"""Contract tests: the calls the frontend makes, against the real FastAPI app (with scripted components)."""
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.imaging import decode_image
from app.main import create_app
from app.material import MATERIALS
from app.measure import ReferenceMeasurer
from app.pipeline import Pipeline
from app.types import Box, Detection
from tests.conftest import make_jpeg


class ScriptedDetector:
    """Returns the next scripted list of boxes on every call."""

    source = "scripted"

    def __init__(self, frames):
        self.frames = list(frames)
        self.i = 0

    def detect(self, image):
        boxes = self.frames[min(self.i, len(self.frames) - 1)]
        self.i += 1
        return [Detection(Box(*b), 0.9) for b in boxes]


class MetalMaterial:
    def classify(self, crops):
        probs = np.full((len(crops), len(MATERIALS)), 0.05)
        probs[:, 1] = 0.8  # metal
        return probs


def client_for(frames):
    cfg = Settings(db_path=":memory:", pipeline="fake", min_hits=2)
    pipe = Pipeline(cfg, ScriptedDetector(frames), ReferenceMeasurer(cfg), MetalMaterial())
    return TestClient(create_app(cfg, pipe))


DOOR = (0.30, 0.12, 0.30, 0.76)
WALKING = [[DOOR], [(0.28, 0.12, 0.30, 0.76)], [(0.26, 0.12, 0.30, 0.76)]]


def test_health_and_cors():
    with client_for(WALKING) as c:
        r = c.get("/health", headers={"Origin": "https://example.vercel.app"})
        assert r.status_code == 200 and r.json()["status"] == "ok"
        assert r.headers["access-control-allow-origin"] == "*"
        pre = c.options("/detect", headers={"Origin": "https://example.vercel.app", "Access-Control-Request-Method": "POST"})
        assert pre.status_code == 200 and "POST" in pre.headers["access-control-allow-methods"]


def test_detect_endpoint(jpeg):
    """POST /detect: multipart frame + scan_id + frame_index -> doors with lowercase material keys."""
    with client_for(WALKING) as c:
        bodies = [c.post("/detect", files={"frame": ("frame.jpg", jpeg, "image/jpeg")},
                         data={"scan_id": "scan-1", "frame_index": str(i)}).json() for i in range(3)]
    assert bodies[0]["doors"] == []  # not confirmed after a single sighting
    door = bodies[1]["doors"][0]
    assert set(door) == {"id", "box", "width_cm", "height_cm", "material", "confidence"}
    assert set(door["box"]) == {"x", "y", "w", "h"} and all(0 <= v <= 1 for v in door["box"].values())
    assert door["material"] == "metal"
    assert isinstance(door["width_cm"], float) and isinstance(door["height_cm"], float)
    assert bodies[2]["doors"][0]["id"] == door["id"]  # same door, same id
    assert bodies[2]["doors"][0]["confidence"] >= door["confidence"]


def test_two_sessions_do_not_share_doors(jpeg):
    with client_for([[DOOR]] * 6) as c:
        for sid in ("a", "b"):
            for _ in range(2):
                r = c.post("/detect", files={"frame": ("f.jpg", jpeg, "image/jpeg")}, data={"scan_id": sid}).json()
        # each session's first door is door-1 (a shared tracker would have produced door-2 for "b")
            assert r["doors"][0]["id"] == "door-1"


def test_bad_uploads_are_rejected_with_a_readable_message():
    with client_for(WALKING) as c:
        r = c.post("/detect", files={"frame": ("f.jpg", b"not an image", "image/jpeg")})
        assert r.status_code == 400 and "valid image" in r.json()["detail"]
        assert c.post("/detect", data={"scan_id": "x"}).status_code == 422  # frame missing


def test_saves_lists_and_deletes_scans():
    body = {
        "id": "7f2c", "site": "Rue du Lac 14",
        "started_at": "2026-09-19T10:02:11.000Z", "finished_at": "2026-09-19T10:14:40.000Z",
        "doors": [{"id": "door-1", "width_cm": 91.2, "height_cm": 203.8, "material": "wood",
                   "confidence": 0.93, "image": "data:image/jpeg;base64,AAAA"},
                  {"id": "door-2", "width_cm": None, "height_cm": None, "material": "unknown", "confidence": None, "image": None}],
    }
    with client_for(WALKING) as c:
        r = c.post("/scans", json=body)
        assert r.status_code == 201 and r.json()["id"] == "7f2c"
        listed = c.get("/scans").json()
        assert isinstance(listed, list) and listed[0]["site"] == "Rue du Lac 14"
        assert listed[0]["doors"][0]["width_cm"] == 91.2 and listed[0]["doors"][1]["width_cm"] is None
        assert listed[0]["doors"][0]["image"].startswith("data:image/jpeg") and listed[0]["created_at"]
        assert c.delete("/scans/7f2c").status_code == 204
        assert c.get("/scans").json() == []
        assert c.delete("/scans/7f2c").status_code == 404


def test_saving_the_same_scan_again_replaces_it():
    with client_for(WALKING) as c:
        for width in (80, 91):
            c.post("/scans", json={"id": "same", "site": "A", "doors": [{"id": "door-1", "width_cm": width}]})
        listed = c.get("/scans").json()
        assert len(listed) == 1 and listed[0]["doors"][0]["width_cm"] == 91


def test_scan_without_a_site_or_id_is_accepted():
    with client_for(WALKING) as c:
        saved = c.post("/scans", json={"doors": []}).json()
        assert saved["id"] and saved["site"] == ""


def test_scans_are_listed_newest_first():
    with client_for(WALKING) as c:
        first = c.post("/scans", json={"site": "first", "doors": []}).json()
        second = c.post("/scans", json={"site": "second", "doors": []}).json()
        assert [s["id"] for s in c.get("/scans").json()] == [second["id"], first["id"]]


def test_the_retired_second_frontend_route_is_gone(jpeg):
    with client_for(WALKING) as c:
        assert c.post("/scan/frame", files={"image": ("f.jpg", jpeg, "image/jpeg")}).status_code == 404


def test_a_database_from_the_two_column_layout_is_upgraded(tmp_path):
    import sqlite3
    from app.store import ScanStore

    path = str(tmp_path / "old.db")
    db = sqlite3.connect(path)
    db.execute("CREATE TABLE scans (id TEXT PRIMARY KEY, name TEXT NOT NULL, site TEXT NOT NULL, "
               "started_at TEXT, finished_at TEXT, created_at TEXT NOT NULL, doors TEXT NOT NULL)")
    db.execute("INSERT INTO scans VALUES ('a', 'Ground floor', '', NULL, NULL, '2026-01-01T00:00:00+00:00', '[]')")
    db.execute("INSERT INTO scans VALUES ('b', 'x', 'Rue du Lac', NULL, NULL, '2026-01-02T00:00:00+00:00', '[]')")
    db.commit()
    db.close()

    store = ScanStore(path)
    assert {s["id"]: s["site"] for s in store.list()} == {"a": "Ground floor", "b": "Rue du Lac"}
    assert store.save(type("S", (), {"id": "c", "site": "New", "started_at": None, "finished_at": None, "doors": []})())["id"] == "c"


def test_decode_image_limits():
    assert decode_image(make_jpeg(2400, 1800)).size[0] <= 1600
    with pytest.raises(ValueError):
        decode_image(b"")
