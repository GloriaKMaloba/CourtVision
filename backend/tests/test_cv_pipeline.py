import sys
import unittest
from pathlib import Path
import numpy as np

# Ensure backend directory is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.cv.features import angle_at, lean_from_vertical, compute_features, FEATURE_NAMES
from app.cv.pose import interp_nans, smooth
from app.cv.detector import BasketballDetector


class TestComputerVisionPipeline(unittest.TestCase):
    def test_angle_at(self):
        # Vertex b at (0, 0), a at (1, 0), c at (0, 1) -> Expected: 90 degrees
        a = np.array([[1.0, 0.0]])
        b = np.array([[0.0, 0.0]])
        c = np.array([[0.0, 1.0]])
        ang = angle_at(a, b, c)
        self.assertAlmostEqual(float(ang[0]), 90.0, places=1)

        # Straight arm: a at (0, 1), b at (0, 0), c at (0, -1) -> Expected: 180 degrees
        a_straight = np.array([[0.0, 1.0]])
        c_straight = np.array([[0.0, -1.0]])
        ang_straight = angle_at(a_straight, b, c_straight)
        self.assertAlmostEqual(float(ang_straight[0]), 180.0, places=1)

    def test_lean_from_vertical(self):
        # Vertical vector: p_from (0, 0) -> p_to (0, 10) (straight up in y)
        p_from = np.array([[0.0, 0.0]])
        p_to = np.array([[0.0, 10.0]])
        lean = lean_from_vertical(p_from, p_to)
        self.assertAlmostEqual(float(lean[0]), 0.0, places=1)

        # 45-degree forward lean: p_to (10, 10)
        p_lean = np.array([[10.0, 10.0]])
        lean_45 = lean_from_vertical(p_from, p_lean)
        self.assertAlmostEqual(float(lean_45[0]), 45.0, places=1)

    def test_interp_nans_and_smooth(self):
        arr = np.array([
            [1.0, 2.0],
            [np.nan, np.nan],
            [3.0, 6.0],
            [np.nan, np.nan],
            [5.0, 10.0]
        ], dtype=np.float32)

        interped = interp_nans(arr)
        self.assertFalse(np.isnan(interped).any())
        self.assertAlmostEqual(float(interped[1, 0]), 2.0, places=1)
        self.assertAlmostEqual(float(interped[1, 1]), 4.0, places=1)

        smoothed = smooth(interped, win=5)
        self.assertEqual(smoothed.shape, arr.shape)

    def test_feature_computation_synthetic(self):
        # Generate synthetic 60 frames (2 seconds at 30 fps) with 33 landmarks
        T = 60
        lms = np.zeros((T, 33, 3), dtype=np.float32)
        # Set high visibility for all landmarks
        lms[:, :, 2] = 0.9

        # Approximate human pose coordinates
        # Nose
        lms[:, 0, :2] = [320, 100]
        # Right shoulder (12)
        lms[:, 12, :2] = [300, 150]
        # Right elbow (14)
        lms[:, 14, :2] = [330, 190]
        # Right wrist (16)
        lms[:, 16, :2] = [340, 130]
        # Right hip (24)
        lms[:, 24, :2] = [300, 270]
        # Right knee (26)
        lms[:, 26, :2] = [305, 360]
        # Right ankle (28)
        lms[:, 28, :2] = [300, 450]

        feats, coverage = compute_features(lms, fps=30.0, release_time=1.0)
        self.assertGreater(coverage, 0.8)
        self.assertIn("elbow_angle", feats)
        self.assertIn("knee_angle", feats)
        self.assertIn("jump_peak", feats)
        self.assertFalse(np.isnan(feats["elbow_angle"]))
        self.assertGreater(feats["elbow_angle"], 30.0)

        # Check all 15 expected feature names are present
        for name in FEATURE_NAMES:
            self.assertIn(name, feats)

    def test_basketball_detector_synthetic_frame(self):
        detector = BasketballDetector.get_instance()
        # Synthetic empty frame
        blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        dets = detector.detect_in_frame(blank_frame)
        self.assertIsInstance(dets, list)


if __name__ == "__main__":
    unittest.main()
