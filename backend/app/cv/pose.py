import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path
from scipy.signal import savgol_filter, find_peaks

# MediaPipe Pose landmark indices (right side shooting)
NOSE, R_SHOULDER, R_ELBOW, R_WRIST, R_HIP, R_KNEE, R_ANKLE = 0, 12, 14, 16, 24, 26, 28
USED = [NOSE, R_SHOULDER, R_ELBOW, R_WRIST, R_HIP, R_KNEE, R_ANKLE]

VIS_THRESHOLD = 0.5
MIN_GAP_S  = 2.5   # shots at least this far apart
MIN_PROM   = 0.8   # peak must stand this far above its surroundings (torso units)
MIN_HEIGHT = 0.0   # wrist must reach nose level or higher
FROZEN_FRAC, FROZEN_LAG = 0.8, 0.0

ML_DIR = Path(__file__).resolve().parent.parent.parent / "ml"
MODEL_PATH = str(ML_DIR / "pose_landmarker_full.task")

def make_landmarker():
    model_file = Path(MODEL_PATH)
    if not model_file.exists():
        import urllib.request
        model_url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
        print(f"Downloading MediaPipe model asset from {model_url}...")
        model_file.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(model_url, str(model_file))

    opts = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_file)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )
    return mp.tasks.vision.PoseLandmarker.create_from_options(opts)

def extract_landmarks(video_path: str, max_width: int = 640):
    """
    Reads video frames and runs MediaPipe Pose Landmarker.
    Returns (lms, fps, width, height, duration)
    lms has shape (frames, 33, 3) where columns are [x_px, y_px, visibility].
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video file at {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0.0

    # Determine if resizing is needed for speed
    scale = 1.0
    if orig_w > max_width and max_width > 0:
        scale = max_width / orig_w
    target_w = int(orig_w * scale)
    target_h = int(orig_h * scale)

    frames = []
    with make_landmarker() as landmarker:
        idx = 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if scale != 1.0:
                bgr = cv2.resize(bgr, (target_w, target_h), interpolation=cv2.INTER_AREA)

            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            res = landmarker.detect_for_video(mp_image, int(idx * 1000 // fps))
            arr = np.full((33, 3), np.nan, dtype=np.float32)
            if res.pose_landmarks and len(res.pose_landmarks) > 0:
                for j, lm in enumerate(res.pose_landmarks[0]):
                    arr[j] = (lm.x * target_w, lm.y * target_h, lm.visibility)
            frames.append(arr)
            idx += 1
    cap.release()

    lms = np.stack(frames) if frames else np.zeros((0, 33, 3), dtype=np.float32)
    return lms, float(fps), orig_w, orig_h, duration

def interp_nans(a):
    """Linear-interpolate NaNs along time for each column of a (T, k) array."""
    a = a.copy()
    t = np.arange(len(a))
    for c in range(a.shape[1]):
        good = ~np.isnan(a[:, c])
        if good.sum() >= 2:
            a[:, c] = np.interp(t, t[good], a[good, c])
    return a

def smooth(a, win=7):
    n = len(a)
    win = min(win, n if n % 2 == 1 else n - 1)
    if win < 5:
        return a
    return savgol_filter(a, window_length=win, polyorder=2, axis=0)

def wrist_and_signal(lms):
    T = len(lms)
    idx = [NOSE, R_SHOULDER, R_WRIST, R_HIP]
    xy = lms[:, idx, :2].copy()
    xy[lms[:, idx, 2] < VIS_THRESHOLD] = np.nan
    pts = smooth(interp_nans(xy.reshape(T, -1))).reshape(T, 4, 2)
    pts[:, :, 1] *= -1
    nose, sh, wr, hip = [pts[:, i] for i in range(4)]
    torso = np.median(np.linalg.norm(sh - hip, axis=1)) + 1e-9
    return wr[:, 1], (wr[:, 1] - nose[:, 1]) / torso

def release_rule(wy, p, fps, frac=FROZEN_FRAC, lag=FROZEN_LAG):
    """First moment the wrist reaches `frac` of its rise, then step back `lag` seconds."""
    T = len(wy)
    lo, hi = max(0, p - int(1.5 * fps)), min(T, p + int(0.3 * fps) + 1)
    base = wy[lo:p + 1].min()
    top = wy[max(0, p - int(0.9 * fps)):hi].max()
    ok = np.where(wy[lo:hi] >= base + frac * (top - base))[0]
    k = lo + (ok[0] if len(ok) else p - lo)
    return max(0.0, k / fps - lag)

def find_shots_in_video(lms, fps):
    """
    Finds all shot occurrences automatically from full landmark video sequence.
    Returns a list of dicts: [{'peak_t': float, 'release_t': float}, ...]
    """
    if len(lms) < int(fps * 2):
        return []
    wy, sig = wrist_and_signal(lms)
    pk, _ = find_peaks(sig, height=MIN_HEIGHT, prominence=MIN_PROM, distance=int(MIN_GAP_S * fps))
    shots = []
    for p in pk:
        peak_t = p / fps
        rel_t = release_rule(wy, p, fps, FROZEN_FRAC, FROZEN_LAG)
        shots.append({
            "peak_t": float(peak_t),
            "release_t": float(rel_t),
        })
    return shots
