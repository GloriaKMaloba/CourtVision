import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

ML_DIR = Path(__file__).resolve().parent.parent.parent / "ml"
YOLO_MODEL_PATH = str(ML_DIR / "best.pt")

class BasketballDetector:
    _instance = None

    def __init__(self):
        if Path(YOLO_MODEL_PATH).exists():
            try:
                self.model = YOLO(YOLO_MODEL_PATH)
            except Exception as e:
                print(f"Warning: Could not initialize YOLO model from {YOLO_MODEL_PATH}: {e}")
                self.model = None
        else:
            self.model = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def detect_in_frame(self, frame_bgr: np.ndarray, conf_threshold: float = 0.25):
        """
        Detects basketball in a single frame.
        Returns list of bounding boxes: [{'bbox': [x1, y1, x2, y2], 'conf': float, 'center': (cx, cy)}]
        """
        if self.model is None:
            return []

        results = self.model.predict(frame_bgr, conf=conf_threshold, verbose=False)
        detections = []
        if len(results) > 0 and results[0].boxes is not None:
            for box in results[0].boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cx = (xyxy[0] + xyxy[2]) / 2.0
                cy = (xyxy[1] + xyxy[3]) / 2.0
                detections.append({
                    "bbox": xyxy,
                    "conf": conf,
                    "center": (cx, cy)
                })
        return detections


def track_ball_in_video(video_path: str, conf_threshold: float = 0.25, max_width: int = 640):
    """
    Extracts video frames via OpenCV, runs YOLOv8 basketball detection,
    and applies trajectory smoothing and missing-frame interpolation.
    Returns: (ball_trajectory_list, fps, total_frames)
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], 30.0, 0

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    scale = 1.0
    if orig_w > max_width and max_width > 0:
        scale = max_width / orig_w
    target_w = int(orig_w * scale)
    target_h = int(orig_h * scale)

    detector = BasketballDetector.get_instance()
    raw_detections = []
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if scale != 1.0:
            frame = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)

        dets = detector.detect_in_frame(frame, conf_threshold=conf_threshold)
        if dets:
            # Pick highest confidence detection
            best = max(dets, key=lambda d: d["conf"])
            raw_detections.append({
                "frame": frame_idx,
                "timestamp": round(frame_idx / fps, 3),
                "cx": best["center"][0],
                "cy": best["center"][1],
                "conf": best["conf"],
                "bbox": best["bbox"],
            })
        else:
            raw_detections.append({
                "frame": frame_idx,
                "timestamp": round(frame_idx / fps, 3),
                "cx": np.nan,
                "cy": np.nan,
                "conf": 0.0,
                "bbox": None,
            })
        frame_idx += 1

    cap.release()

    if not raw_detections:
        return [], fps, 0

    # Trajectory smoothing & missing frame interpolation
    cx_vals = np.array([d["cx"] for d in raw_detections], dtype=np.float32)
    cy_vals = np.array([d["cy"] for d in raw_detections], dtype=np.float32)

    valid_mask = ~np.isnan(cx_vals)
    t = np.arange(len(raw_detections))

    if valid_mask.sum() >= 2:
        cx_interp = np.interp(t, t[valid_mask], cx_vals[valid_mask])
        cy_interp = np.interp(t, t[valid_mask], cy_vals[valid_mask])
        for i, d in enumerate(raw_detections):
            d["smooth_cx"] = float(cx_interp[i])
            d["smooth_cy"] = float(cy_interp[i])
            d["interpolated"] = not valid_mask[i]
    else:
        for d in raw_detections:
            d["smooth_cx"] = d["cx"]
            d["smooth_cy"] = d["cy"]
            d["interpolated"] = False

    return raw_detections, fps, frame_idx
