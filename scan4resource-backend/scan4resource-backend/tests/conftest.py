import io
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402


@pytest.fixture
def cfg():
    return Settings(db_path=":memory:", pipeline="fake")


def make_jpeg(width=320, height=240, color=(200, 200, 200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def jpeg():
    return make_jpeg()
