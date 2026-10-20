import sys
import unittest
from unittest.mock import patch
from pathlib import Path
import numpy as np

# Ensure backend directory is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from app.config import Config
from app.models.user import db, User, AthleteProfile
from app.models.video import Video, VideoProcessingJob
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.cv.classifier import ShotClassifier, classify_shot
from app.cv.pipeline import process_video_pipeline


class TestShotClassifier(unittest.TestCase):
    def setUp(self):
        self.classifier = ShotClassifier.get_instance()

    def test_classifier_loads(self):
        self.assertIsNotNone(self.classifier)
        self.assertIsNotNone(self.classifier.model)
        self.assertEqual(len(self.classifier.features), 15)
        self.assertIn("elbow_angle", self.classifier.features)
        self.assertIn("jump_peak", self.classifier.features)

    def test_classifier_predict_valid(self):
        # Sample realistic 3-point feature set (deeper knee dip, higher leap, higher wrist rise)
        features_3pt = {
            "elbow_angle": 128.5,
            "knee_angle": 105.0,
            "hip_angle": 130.0,
            "shoulder_angle": 85.0,
            "wrist_above_shoulder": 0.58,
            "wrist_above_head": 0.35,
            "forearm_lean": 14.0,
            "trunk_lean": 8.5,
            "min_knee_pre": 98.0,
            "knee_extension": 48.0,
            "t_min_knee_to_release": 0.42,
            "jump_at_release": 0.28,
            "jump_peak": 0.42,
            "max_knee_ext_speed": 420.0,
            "max_wrist_rise_speed": 12.5,
        }
        shot_type, conf = self.classifier.predict(features_3pt)
        self.assertIn(shot_type, ["two_point", "three_point"])
        self.assertGreaterEqual(conf, 0.50)
        self.assertLessEqual(conf, 1.00)

        # Helper function
        h_type, h_conf = classify_shot(features_3pt)
        self.assertEqual(shot_type, h_type)
        self.assertEqual(conf, h_conf)

    def test_classifier_partial_nan_robustness(self):
        # Some features missing/NaN
        features_partial = {
            "elbow_angle": 120.0,
            "knee_angle": 115.0,
            "hip_angle": 140.0,
            "shoulder_angle": 78.0,
            "wrist_above_shoulder": 0.50,
            "wrist_above_head": None,
            "forearm_lean": 10.0,
            "trunk_lean": 5.0,
            "min_knee_pre": 110.0,
            "knee_extension": 35.0,
            "t_min_knee_to_release": 0.35,
            "jump_at_release": 0.18,
            "jump_peak": 0.30,
            "max_knee_ext_speed": np.nan,
            "max_wrist_rise_speed": 9.5,
        }
        shot_type, conf = self.classifier.predict(features_partial)
        self.assertIn(shot_type, ["two_point", "three_point"])
        self.assertIsInstance(conf, float)

    def test_classifier_empty_dict_fallback(self):
        shot_type, conf = self.classifier.predict({})
        self.assertEqual(shot_type, "two_point")
        self.assertEqual(conf, 0.50)

    def test_classifier_batch_prediction(self):
        batch = [
            {"elbow_angle": 120.0, "jump_peak": 0.3},
            {"elbow_angle": 135.0, "jump_peak": 0.45},
        ]
        results = self.classifier.predict_batch(batch)
        self.assertEqual(len(results), 2)
        for s_type, conf in results:
            self.assertIn(s_type, ["two_point", "three_point"])
            self.assertGreaterEqual(conf, 0.50)


class TestMetricsPersistence(unittest.TestCase):
    def setUp(self):
        class TestConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

        self.app = create_app(TestConfig)


        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed test user & athlete profile
        user = User(email="test_shooter@courtvision.ke", full_name="Kevin Ouma", role="athlete")
        user.set_password("pass123")
        db.session.add(user)
        db.session.commit()

        athlete = AthleteProfile(user_id=user.id, county="Nairobi", height_cm=190.0)
        db.session.add(athlete)
        db.session.commit()

        self.user = user
        self.athlete = athlete

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_shot_analysis_and_metric_crud(self):
        video = Video(
            user_id=self.user.id,
            athlete_id=self.athlete.id,
            title="Drill Session 1",
            original_filename="drill.mp4",
            stored_filename="test_uuid_drill.mp4",
            file_path="/tmp/drill.mp4",
            file_size_bytes=1048576,
            mime_type="video/mp4",
            status="completed",
        )
        db.session.add(video)
        db.session.commit()

        # Persist two shots
        shot1 = ShotAnalysis(
            video_id=video.id,
            shot_index=1,
            timestamp_start=1.2,
            timestamp_release=1.8,
            timestamp_end=2.4,
            shot_type="two_point",
            classification_confidence=0.88,
        )
        db.session.add(shot1)
        db.session.flush()

        metric1 = PerformanceMetric(
            shot_analysis_id=shot1.id,
            shooting_angle_deg=122.4,
            jump_height_cm=44.5,
            release_time_sec=0.45,
            release_height_relative=0.62,
        )
        db.session.add(metric1)

        shot2 = ShotAnalysis(
            video_id=video.id,
            shot_index=2,
            timestamp_start=4.5,
            timestamp_release=5.1,
            timestamp_end=5.8,
            shot_type="three_point",
            classification_confidence=0.92,
        )
        db.session.add(shot2)
        db.session.flush()

        metric2 = PerformanceMetric(
            shot_analysis_id=shot2.id,
            shooting_angle_deg=134.8,
            jump_height_cm=52.0,
            release_time_sec=0.52,
            release_height_relative=0.70,
        )
        db.session.add(metric2)
        db.session.commit()

        # Query back from database
        loaded_video = db.session.get(Video, video.id)
        self.assertEqual(loaded_video.shots.count(), 2)

        data = loaded_video.to_dict(include_shots=True)
        self.assertIn("shots", data)
        self.assertEqual(len(data["shots"]), 2)
        self.assertEqual(data["shots"][0]["shot_type"], "two_point")
        self.assertEqual(data["shots"][0]["metric"]["shooting_angle_deg"], 122.4)
        self.assertEqual(data["shots"][1]["shot_type"], "three_point")
        self.assertEqual(data["shots"][1]["metric"]["jump_height_cm"], 52.0)

        # Verify session summary aggregates
        summary = data["summary"]
        self.assertIsNotNone(summary)
        self.assertEqual(summary["total_shots"], 2)
        self.assertEqual(summary["two_pointers"], 1)
        self.assertEqual(summary["three_pointers"], 1)
        self.assertAlmostEqual(summary["avg_shooting_angle"], (122.4 + 134.8) / 2, places=1)
        self.assertAlmostEqual(summary["avg_jump_height"], (44.5 + 52.0) / 2, places=1)
        self.assertEqual(summary["max_jump_height"], 52.0)

    @patch("app.cv.pipeline.extract_landmarks")
    @patch("app.cv.pipeline.find_shots_in_video")
    def test_pipeline_end_to_end_mock(self, mock_find_shots, mock_extract_landmarks):
        video = Video(
            user_id=self.user.id,
            athlete_id=self.athlete.id,
            title="Full Video Session",
            original_filename="full.mp4",
            stored_filename="uuid_full.mp4",
            file_path="/tmp/full.mp4",
            file_size_bytes=2048576,
            mime_type="video/mp4",
            status="pending",
        )
        db.session.add(video)
        db.session.commit()

        job = VideoProcessingJob(video_id=video.id, status="pending", stage="queued")
        db.session.add(job)
        db.session.commit()

        # Mock MediaPipe 90 frames (3 seconds at 30 fps) with simulated upward leap
        mock_lms = np.zeros((90, 33, 3), dtype=np.float32)
        mock_lms[:, :, 2] = 0.95
        mock_lms[:, 0, :2] = [320, 100]  # nose
        mock_lms[:, 12, :2] = [300, 160] # shoulder
        mock_lms[:, 14, :2] = [320, 210] # elbow
        mock_lms[:, 16, :2] = [330, 140] # wrist
        mock_lms[:, 24, :2] = [300, 280] # hip
        mock_lms[:, 26, :2] = [305, 370] # knee
        mock_lms[:, 28, :2] = [300, 460] # ankle

        # Simulate jump elevation around release (frames 40-55 rise upward in y)
        mock_lms[40:55, [24, 26, 28], 1] -= 30.0

        mock_extract_landmarks.return_value = (mock_lms, 30.0, 640, 480, 3.0)
        mock_find_shots.return_value = [
            {"release_t": 1.5, "peak_t": 1.7},
        ]

        result = process_video_pipeline(video.id)

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["shots_detected"], 1)

        db.session.refresh(video)
        db.session.refresh(job)

        self.assertEqual(video.status, "completed")
        self.assertEqual(job.status, "completed")
        self.assertEqual(job.stage, "done")
        self.assertEqual(video.shots.count(), 1)

        persisted_shot = video.shots.first()
        self.assertEqual(persisted_shot.shot_index, 1)
        self.assertIn(persisted_shot.shot_type, ["two_point", "three_point"])
        self.assertIsNotNone(persisted_shot.metric)
        self.assertGreaterEqual(persisted_shot.metric.jump_height_cm, 0.0)
        self.assertGreater(persisted_shot.metric.shooting_angle_deg, 0.0)

    @patch("app.cv.pipeline.extract_landmarks")
    @patch("app.cv.pipeline.find_shots_in_video")
    def test_pipeline_zero_shots_detected(self, mock_find_shots, mock_extract_landmarks):
        video = Video(
            user_id=self.user.id,
            athlete_id=self.athlete.id,
            title="Empty Drill",
            original_filename="empty.mp4",
            stored_filename="uuid_empty.mp4",
            file_path="/tmp/empty.mp4",
            file_size_bytes=512000,
            mime_type="video/mp4",
            status="pending",
        )
        db.session.add(video)
        db.session.commit()

        job = VideoProcessingJob(video_id=video.id, status="pending", stage="queued")
        db.session.add(job)
        db.session.commit()

        mock_lms = np.zeros((60, 33, 3), dtype=np.float32)
        mock_lms[:, :, 2] = 0.90
        mock_extract_landmarks.return_value = (mock_lms, 30.0, 640, 480, 2.0)
        mock_find_shots.return_value = []  # No shots detected

        result = process_video_pipeline(video.id)

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["shots_detected"], 0)

        db.session.refresh(video)
        db.session.refresh(job)

        self.assertEqual(video.status, "completed")
        self.assertEqual(job.status, "completed")
        self.assertEqual(job.stage, "done")
        self.assertEqual(video.shots.count(), 0)

    @patch("app.cv.pipeline.extract_landmarks")
    def test_pipeline_error_handling(self, mock_extract_landmarks):
        video = Video(
            user_id=self.user.id,
            athlete_id=self.athlete.id,
            title="Corrupted Video",
            original_filename="corrupt.mp4",
            stored_filename="uuid_corrupt.mp4",
            file_path="/tmp/corrupt.mp4",
            file_size_bytes=1000,
            mime_type="video/mp4",
            status="pending",
        )
        db.session.add(video)
        db.session.commit()

        job = VideoProcessingJob(video_id=video.id, status="pending", stage="queued")
        db.session.add(job)
        db.session.commit()

        mock_extract_landmarks.side_effect = RuntimeError("Corrupted codec header")

        with self.assertRaises(RuntimeError):
            process_video_pipeline(video.id)

        db.session.refresh(video)
        db.session.refresh(job)

        self.assertEqual(video.status, "failed")
        self.assertEqual(job.status, "failed")
        self.assertIn("Corrupted codec header", job.error_message)


if __name__ == "__main__":
    unittest.main()
