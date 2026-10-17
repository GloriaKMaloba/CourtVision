import numpy as np
from app.cv.pose import USED, interp_nans, smooth, VIS_THRESHOLD

FEATURE_NAMES = [
    "elbow_angle", "knee_angle", "hip_angle", "shoulder_angle",
    "wrist_above_shoulder", "wrist_above_head", "forearm_lean", "trunk_lean",
    "min_knee_pre", "knee_extension", "t_min_knee_to_release",
    "jump_at_release", "jump_peak", "max_knee_ext_speed", "max_wrist_rise_speed",
]

def angle_at(a, b, c):
    """Angle in degrees at vertex b formed by a-b-c. Inputs shape (T, 2)."""
    v1, v2 = a - b, c - b
    cosang = (v1 * v2).sum(1) / (np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1) + 1e-9)
    return np.degrees(np.arccos(np.clip(cosang, -1, 1)))

def lean_from_vertical(p_from, p_to):
    """Signed angle (deg) of vector p_from->p_to relative to straight up (y up)."""
    d = p_to - p_from
    return np.degrees(np.arctan2(d[:, 0], d[:, 1]))

def compute_features(lms, fps, release_time):
    """
    Computes the 15 biomechanical features around a 4-second shot window.
    lms: (T, 33, 3) where columns are [x, y, vis].
    Returns: (features_dict, coverage_float)
    """
    T = len(lms)
    feats = {k: np.nan for k in FEATURE_NAMES}
    if T < 10:
        return feats, 0.0

    xy = lms[:, USED, :2].copy()           # (T, 7, 2)
    vis = lms[:, USED, 2]                  # (T, 7)
    xy[vis < VIS_THRESHOLD] = np.nan
    coverage = float(np.mean(~np.isnan(xy).any(axis=(1, 2))))
    if coverage < 0.3:
        return feats, coverage

    flat = interp_nans(xy.reshape(T, -1))
    flat = smooth(flat)
    pts = flat.reshape(T, 7, 2)
    pts[:, :, 1] *= -1                     # y up (higher y = higher elevation)
    nose, sh, el, wr, hip, kn, an = [pts[:, i, :] for i in range(7)]

    r = int(np.clip(round(release_time * fps), 0, T - 1))

    # Normalize shooter facing direction (+x)
    lo, hi = max(0, r - 3), min(T, r + 4)
    facing = np.sign(np.nanmedian(wr[lo:hi, 0] - hip[lo:hi, 0]))
    if facing < 0:
        for arr in (nose, sh, el, wr, hip, kn, an):
            arr[:, 0] *= -1

    torso = float(np.median(np.linalg.norm(sh - hip, axis=1))) + 1e-9

    elbow = angle_at(sh, el, wr)
    knee = angle_at(hip, kn, an)
    hip_ang = angle_at(sh, hip, kn)
    sh_ang = angle_at(hip, sh, el)

    feats["elbow_angle"] = float(elbow[r])
    feats["knee_angle"] = float(knee[r])
    feats["hip_angle"] = float(hip_ang[r])
    feats["shoulder_angle"] = float(sh_ang[r])
    feats["wrist_above_shoulder"] = float((wr[r, 1] - sh[r, 1]) / torso)
    feats["wrist_above_head"] = float((wr[r, 1] - nose[r, 1]) / torso)
    feats["forearm_lean"] = float(lean_from_vertical(el, wr)[r])
    feats["trunk_lean"] = float(lean_from_vertical(hip, sh)[r])

    # Window features: knee dip & extension
    pre_start = max(0, r - int(1.5 * fps))
    seg = knee[pre_start:r + 1]
    j = int(np.argmin(seg))
    feats["min_knee_pre"] = float(seg[j])
    feats["knee_extension"] = float(knee[r] - seg[j])
    feats["t_min_knee_to_release"] = float((r - (pre_start + j)) / fps)

    # Jump height: hip height above standing baseline, in torso-lengths
    away = np.ones(T, dtype=bool)
    away[max(0, r - int(0.6 * fps)):min(T, r + int(0.6 * fps) + 1)] = False
    base = np.median(hip[away, 1]) if away.sum() >= 5 else np.percentile(hip[:, 1], 20)
    jump = (hip[:, 1] - base) / torso
    w0, w1 = max(0, r - int(0.5 * fps)), min(T, r + int(0.5 * fps) + 1)
    feats["jump_at_release"] = float(jump[r])
    feats["jump_peak"] = float(jump[w0:w1].max())

    sp0 = max(0, r - int(0.8 * fps))
    knee_speed = np.gradient(knee) * fps
    wrist_speed = np.gradient(wr[:, 1]) * fps / torso
    feats["max_knee_ext_speed"] = float(knee_speed[sp0:r + 1].max())
    feats["max_wrist_rise_speed"] = float(wrist_speed[sp0:r + 1].max())

    return feats, coverage
