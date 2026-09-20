import numpy as np

from app.config import Settings
from app.tracker import SessionTracker, TrackerStore, weighted_median
from app.types import Box, Detection, Observation


def det(x, y, w, h, conf=0.9, hist=None):
    return Detection(Box(x, y, w, h), conf, hist)


def test_same_door_keeps_its_id_while_the_camera_moves():
    t = SessionTracker(Settings())
    ids = set()
    # the door drifts to the left as the person walks, ~0.6 s between frames
    for i in range(6):
        for track, _ in t.update([det(0.40 - 0.03 * i, 0.15, 0.30, 0.70)], now=i * 0.6):
            ids.add(track.id)
    assert ids == {"door-1"}


def test_two_different_doors_get_two_ids():
    t = SessionTracker(Settings())
    for i in range(3):
        matched = t.update([det(0.05, 0.2, 0.25, 0.6), det(0.65, 0.2, 0.25, 0.6)], now=i * 0.6)
    assert {track.id for track, _ in matched} == {"door-1", "door-2"}


def test_door_is_reported_only_after_min_hits():
    cfg = Settings(min_hits=2)
    t = SessionTracker(cfg)
    (track, _), = t.update([det(0.3, 0.2, 0.3, 0.6)], now=0.0)
    assert not track.confirmed(cfg.min_hits)
    (track, _), = t.update([det(0.31, 0.2, 0.3, 0.6)], now=0.6)
    assert track.confirmed(cfg.min_hits)
    assert t.confirmed_count == 1


def test_door_that_reappears_after_a_long_gap_is_new_by_default():
    t = SessionTracker(Settings(max_gap_s=2.0))
    t.update([det(0.3, 0.2, 0.3, 0.6)], now=0.0)
    t.update([det(0.3, 0.2, 0.3, 0.6)], now=0.6)
    matched = t.update([det(0.3, 0.2, 0.3, 0.6)], now=30.0)
    assert matched[0][0].id == "door-2"


def test_reid_reconnects_a_returning_door_when_enabled():
    hist = np.zeros(128, dtype=np.float32)
    hist[5] = 1.0
    t = SessionTracker(Settings(max_gap_s=2.0, reid=True))
    t.update([det(0.3, 0.2, 0.3, 0.6, hist=hist)], now=0.0)
    t.update([det(0.3, 0.2, 0.3, 0.6, hist=hist)], now=0.6)
    matched = t.update([det(0.35, 0.2, 0.3, 0.6, hist=hist)], now=30.0)
    assert matched[0][0].id == "door-1"


def test_reid_does_not_merge_doors_of_different_colour():
    a = np.zeros(128, dtype=np.float32); a[5] = 1.0
    b = np.zeros(128, dtype=np.float32); b[90] = 1.0
    t = SessionTracker(Settings(max_gap_s=2.0, reid=True))
    t.update([det(0.3, 0.2, 0.3, 0.6, hist=a)], now=0.0)
    t.update([det(0.3, 0.2, 0.3, 0.6, hist=a)], now=0.6)
    matched = t.update([det(0.3, 0.2, 0.3, 0.6, hist=b)], now=30.0)
    assert matched[0][0].id == "door-2"


def test_size_is_a_weighted_median_and_confidence_grows_with_readings():
    t = SessionTracker(Settings())
    (track, _), = t.update([det(0.3, 0.2, 0.3, 0.6, conf=0.9)], now=0.0)
    assert track.size_cm() == (None, None)
    before = track.confidence()
    for w, h, q in [(90, 205, 0.8), (91, 204, 0.8), (140, 250, 0.1), (89, 206, 0.9)]:
        track.add_observation(Observation(w, h, q))
    assert track.size_cm() == (90.0, 205.0)  # the outlier reading barely counts
    assert track.confidence() > before


def test_sessions_are_separate_and_expire():
    cfg = Settings(session_ttl_s=100)
    store = TrackerStore(cfg)
    a, b = store.get("a", now=0), store.get("b", now=0)
    assert a is not b and store.get("a", now=50) is a
    assert store.get("a", now=500) is not a


def test_weighted_median_basic():
    assert weighted_median([1, 2, 3], [1, 1, 1]) == 2
    assert weighted_median([], []) is None


def test_a_missed_frame_does_not_split_a_door_but_a_long_gap_does():
    t = SessionTracker(Settings(max_gap_s=2.0))
    t.update([det(0.30, 0.2, 0.3, 0.6)], now=0.0)
    t.update([det(0.30, 0.2, 0.3, 0.6)], now=0.6)
    # detector misses two frames (1.2 s): still the same door
    assert t.update([det(0.28, 0.2, 0.3, 0.6)], now=1.8)[0][0].id == "door-1"
    # a different door 3 s later, in an overlapping place, is not glued to the old one
    assert t.update([det(0.30, 0.2, 0.3, 0.6)], now=5.0)[0][0].id == "door-2"
