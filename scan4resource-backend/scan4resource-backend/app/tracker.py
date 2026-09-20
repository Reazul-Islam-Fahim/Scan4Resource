"""Count each door once: give the same physical door the same id across frames.

Frames arrive about every 600 ms from a moving phone, so boxes move a lot between frames. A door is
matched to an existing track by overlap (IoU), or, if it moved further, by being close, similarly
sized and similarly coloured. Doors that leave the view and come back are, by default, counted as new:
identical white interior doors look alike, so matching them by colour would merge different doors
(see REID in the README).
"""
from __future__ import annotations

import math
import threading
import time
from typing import Optional

import numpy as np

from .config import Settings
from .imaging import hist_similarity
from .types import Box, Detection, Observation


def weighted_median(values: list[float], weights: list[float]) -> Optional[float]:
    if not values:
        return None
    order = np.argsort(values)
    v = np.asarray(values, dtype=float)[order]
    w = np.asarray(weights, dtype=float)[order]
    cum = np.cumsum(w)
    return float(v[int(np.searchsorted(cum, cum[-1] / 2.0))])


class Track:
    def __init__(self, track_id: str, det: Detection, now: float):
        self.id = track_id
        self.box = det.box
        self.conf = det.conf
        self.hist = det.hist
        self.hits = 1
        self.first_seen = now
        self.last_seen = now
        self._widths: list[float] = []
        self._heights: list[float] = []
        self._weights: list[float] = []
        self._material_sum: Optional[np.ndarray] = None
        self.material_obs = 0

    # ---- updates ------------------------------------------------------------------
    def update(self, det: Detection, now: float) -> None:
        self.box = det.box
        self.conf = 0.7 * self.conf + 0.3 * det.conf
        self.hits += 1
        self.last_seen = now
        if det.hist is not None:
            self.hist = det.hist if self.hist is None else 0.8 * self.hist + 0.2 * det.hist

    def add_observation(self, obs: Optional[Observation]) -> None:
        if obs is None or obs.quality <= 0:
            return
        self._widths.append(obs.width_cm)
        self._heights.append(obs.height_cm)
        self._weights.append(obs.quality)

    def add_material(self, probs: np.ndarray, weight: float) -> None:
        weighted = np.asarray(probs, dtype=float) * max(weight, 1e-3)
        self._material_sum = weighted if self._material_sum is None else self._material_sum + weighted
        self.material_obs += 1

    # ---- read-outs ------------------------------------------------------------------
    def confirmed(self, min_hits: int) -> bool:
        return self.hits >= min_hits

    def size_cm(self) -> tuple[Optional[float], Optional[float]]:
        w = weighted_median(self._widths, self._weights)
        h = weighted_median(self._heights, self._weights)
        return (round(w, 1) if w is not None else None, round(h, 1) if h is not None else None)

    def material_probs(self) -> Optional[np.ndarray]:
        if self._material_sum is None:
            return None
        return self._material_sum / float(self._material_sum.sum())

    def confidence(self) -> float:
        """Grows as more good size readings accumulate, so the app keeps the best (latest) reading."""
        reliability = 1.0 - math.exp(-sum(self._weights) / 3.0) if self._weights else 0.0
        return round(min(0.99, self.conf * (0.5 + 0.5 * reliability)), 3)


class SessionTracker:
    """All the doors seen during one walkthrough."""

    def __init__(self, cfg: Settings):
        self.cfg = cfg
        self.tracks: list[Track] = []
        self._next = 1
        self.lock = threading.Lock()

    def update(self, detections: list[Detection], now: float) -> list[tuple[Track, Detection]]:
        cfg = self.cfg
        active = [t for t in self.tracks if now - t.last_seen <= cfg.max_gap_s]

        candidates = []
        for di, det in enumerate(detections):
            for ti, track in enumerate(active):
                iou = det.box.iou(track.box)
                sim = hist_similarity(det.hist, track.hist)
                close = det.box.center_distance(track.box) <= cfg.match_dist and _similar_size(det.box, track.box)
                if iou >= cfg.match_iou or (close and sim >= 0.6):
                    candidates.append((iou + 0.5 * sim, di, ti))
        candidates.sort(reverse=True)

        used_det, used_track = set(), set()
        matched: list[tuple[Track, Detection]] = []
        for _, di, ti in candidates:
            if di in used_det or ti in used_track:
                continue
            used_det.add(di)
            used_track.add(ti)
            active[ti].update(detections[di], now)
            matched.append((active[ti], detections[di]))

        for di, det in enumerate(detections):
            if di in used_det:
                continue
            track = self._revive(det, now) if cfg.reid else None
            if track is not None:
                track.update(det, now)
            else:
                track = Track(f"door-{self._next}", det, now)
                self._next += 1
                self.tracks.append(track)
            matched.append((track, det))
        return matched

    def _revive(self, det: Detection, now: float) -> Optional[Track]:
        """Optional: match a returning door to an earlier one by colour and shape."""
        best, best_sim = None, self.cfg.reid_sim
        for track in self.tracks:
            if now - track.last_seen <= self.cfg.max_gap_s or not track.confirmed(self.cfg.min_hits):
                continue
            sim = hist_similarity(det.hist, track.hist)
            if sim >= best_sim and _similar_aspect(det.box, track.box):
                best, best_sim = track, sim
        return best

    @property
    def confirmed_count(self) -> int:
        return sum(1 for t in self.tracks if t.confirmed(self.cfg.min_hits))


def _similar_size(a: Box, b: Box) -> bool:
    ratio = a.h / b.h if b.h > 0 else 0.0
    return 0.6 <= ratio <= 1.7


def _similar_aspect(a: Box, b: Box) -> bool:
    if a.h <= 0 or b.h <= 0 or a.w <= 0 or b.w <= 0:
        return False
    return abs(math.log((a.w / a.h) / (b.w / b.h))) < 0.25


class TrackerStore:
    """One SessionTracker per scan id, with old sessions dropped after a while."""

    def __init__(self, cfg: Settings):
        self.cfg = cfg
        self._sessions: dict[str, tuple[SessionTracker, float]] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str, now: Optional[float] = None) -> SessionTracker:
        now = time.monotonic() if now is None else now
        with self._lock:
            for key in [k for k, (_, seen) in self._sessions.items() if now - seen > self.cfg.session_ttl_s]:
                del self._sessions[key]
            tracker = self._sessions[session_id][0] if session_id in self._sessions else SessionTracker(self.cfg)
            self._sessions[session_id] = (tracker, now)
            return tracker
