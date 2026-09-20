import math

import numpy as np

from app.measure import size_from_depth, size_from_reference
from app.types import Box

W, H = 640, 480
F = 0.75 * max(W, H)  # focal length in pixels, same rule as the app


def scene(door_w=0.9, door_h=2.05, z0=3.0, yaw_deg=0.0):
    """Depth map + box of a door hanging on a plane `z0` metres away, turned by `yaw_deg`."""
    th = math.radians(yaw_deg)
    normal = np.array([math.sin(th), 0.0, -math.cos(th)])
    p0 = np.array([0.0, 0.0, z0])
    us, vs = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
    rays = np.stack([(us - W / 2) / F, (vs - H / 2) / F, np.ones_like(us)], axis=-1)
    depth = (normal @ p0) / (rays @ normal)  # z of the ray/plane intersection

    tangent = np.array([math.cos(th), 0.0, math.sin(th)])
    corners = [p0 + sx * door_w / 2 * tangent + np.array([0, sy * door_h / 2, 0]) for sx in (-1, 1) for sy in (-1, 1)]
    px = np.array([[c[0] / c[2] * F + W / 2, c[1] / c[2] * F + H / 2] for c in corners])
    x0, y0 = px.min(axis=0)
    x1, y1 = px.max(axis=0)
    return depth.astype(np.float32), Box(x0 / W, y0 / H, (x1 - x0) / W, (y1 - y0) / H)


def test_recovers_size_of_a_door_facing_the_camera():
    depth, box = scene()
    obs = size_from_depth(depth, box, F)
    assert obs is not None
    assert abs(obs.width_cm - 90) < 3
    assert abs(obs.height_cm - 205) < 4


def test_recovers_size_of_a_door_seen_at_an_angle():
    depth, box = scene(yaw_deg=30)
    obs = size_from_depth(depth, box, F)
    assert obs is not None
    assert abs(obs.width_cm - 90) < 5, obs.width_cm  # the projected width alone would be ~78 cm
    assert abs(obs.height_cm - 205) < 5


def test_rejects_a_door_seen_almost_edge_on():
    depth, box = scene(yaw_deg=70)
    assert size_from_depth(depth, box, F) is None


def test_rejects_a_door_cut_off_by_the_frame():
    depth, box = scene(z0=1.6)  # so close that it fills more than the frame
    assert size_from_depth(depth, box, F) is None


def test_scale_factor_calibrates_the_result():
    depth, box = scene()
    assert abs(size_from_depth(depth, box, F, scale=1.1).width_cm - 99) < 3.5


def test_reference_mode_uses_the_standard_height():
    obs = size_from_reference(Box(0.3, 0.1, 0.2, 0.8), 600, 800, 205.0)
    assert obs.height_cm == 205.0
    assert abs(obs.width_cm - 205 * (0.2 * 600) / (0.8 * 800)) < 1e-6
    assert size_from_reference(Box(0.0, 0.1, 0.2, 0.8), 600, 800, 205.0) is None  # touches the edge
