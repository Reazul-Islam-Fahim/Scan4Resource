"""PIPELINE=fake must work end to end without any model, for connectivity checks."""
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_fake_pipeline_reports_three_doors_over_a_walkthrough(jpeg):
    with TestClient(create_app(Settings(pipeline="fake", db_path=":memory:"))) as c:
        assert c.get("/health").json()["pipeline"] == "fake"
        ids = set()
        for _ in range(34):
            for door in c.post("/detect", files={"frame": ("f.jpg", jpeg, "image/jpeg")}, data={"scan_id": "s"}).json()["doors"]:
                ids.add(door["id"])
        assert len(ids) == 3
