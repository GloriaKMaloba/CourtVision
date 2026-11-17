import io
import sys
import time
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np

# Ensure backend root is on Python sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from app.config import Config
from app.models.user import db, User, AthleteProfile, ScoutProfile
from app.models.video import Video, VideoProcessingJob
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.cv.classifier import ShotClassifier
from app.cv.pipeline import process_video_pipeline
from app.cv.features import compute_features


class TestEndToEndWorkflow(unittest.TestCase):
    """
    Validates complete functional flow across the frontend API contracts:
    Registration -> Ingestion -> CV Processing -> Persistence -> Analytics -> Scouting.
    """

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

        class TestConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
            UPLOAD_FOLDER = self.temp_dir

        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    @patch("app.cv.pipeline.extract_landmarks")
    @patch("app.cv.pipeline.find_shots_in_video")
    def test_full_athlete_to_scout_lifecycle(self, mock_find_shots, mock_extract_landmarks):
        # 1. Athlete Registration
        athlete_payload = {
            "email": "omondi.athlete@courtvision.ke",
            "password": "SecurePassword123",
            "full_name": "Victor Omondi",
            "role": "athlete",
            "county": "Kisumu",
            "position": "Shooting Guard",
            "height_cm": 194.0,
            "school_or_club": "Lakers Basketball Academy",
        }
        res = self.client.post("/api/auth/register", json=athlete_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn("token", data)
        athlete_token = data["token"]
        athlete_id = data["user"]["id"]
        headers_athlete = {"Authorization": f"Bearer {athlete_token}"}

        # 2. Athlete Uploads Video
        video_bytes = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41" + b"0" * 2048
        data_upload = {
            "title": "Kisumu County Elite Shooting Drill",
            "video": (io.BytesIO(video_bytes), "drill_session_1.mp4"),
        }
        with patch("threading.Thread.start"):
            res_upload = self.client.post(
                "/api/videos/upload",
                data=data_upload,
                content_type="multipart/form-data",
                headers=headers_athlete,
            )
        self.assertEqual(res_upload.status_code, 201)
        upload_json = res_upload.get_json()
        self.assertIn("video", upload_json)
        video_id = upload_json["video"]["id"]

        # Verify initial database state
        vid_record = db.session.get(Video, video_id)
        self.assertIsNotNone(vid_record)
        self.assertEqual(vid_record.title, "Kisumu County Elite Shooting Drill")
        self.assertEqual(vid_record.user_id, athlete_id)

        # 3. Computer Vision Processing Mock
        # Prepare 120 simulated frames (4.0 seconds at 30 fps) with a clear shot release
        mock_lms = np.zeros((120, 33, 3), dtype=np.float32)
        mock_lms[:, :, 2] = 0.95 # High visibility
        mock_lms[:, 0, :2] = [320, 100]  # nose
        mock_lms[:, 12, :2] = [300, 160] # shoulder
        mock_lms[:, 14, :2] = [320, 210] # elbow
        mock_lms[:, 16, :2] = [330, 130] # wrist
        mock_lms[:, 24, :2] = [300, 280] # hip
        mock_lms[:, 26, :2] = [305, 370] # knee
        mock_lms[:, 28, :2] = [300, 460] # ankle

        # Simulate vertical displacement during jump phase (frames 45-65)
        mock_lms[45:65, [24, 26, 28], 1] -= 35.0

        mock_extract_landmarks.return_value = (mock_lms, 30.0, 640, 480, 4.0)
        mock_find_shots.return_value = [
            {"release_t": 1.8, "peak_t": 2.0},
        ]

        # Process pipeline for this video
        pipeline_result = process_video_pipeline(video_id)
        self.assertEqual(pipeline_result["status"], "completed")
        self.assertEqual(pipeline_result["shots_detected"], 1)

        # 4. Athlete Checks Results Endpoint
        res_results = self.client.get(f"/api/videos/{video_id}/results", headers=headers_athlete)
        self.assertEqual(res_results.status_code, 200)
        results_json = res_results.get_json()
        self.assertEqual(results_json["video"]["status"], "completed")
        self.assertEqual(len(results_json["shots"]), 1)
        shot_data = results_json["shots"][0]
        self.assertIn(shot_data["shot_type"], ["two_point", "three_point"])
        self.assertGreater(shot_data["metric"]["shooting_angle_deg"], 0.0)
        self.assertGreater(shot_data["metric"]["jump_height_cm"], 0.0)

        # 5. Athlete Checks Aggregated Metrics
        res_metrics = self.client.get("/api/athlete/me/metrics", headers=headers_athlete)
        self.assertEqual(res_metrics.status_code, 200)
        metrics_json = res_metrics.get_json()["metrics"]
        self.assertEqual(metrics_json["total_shots"], 1)
        self.assertEqual(metrics_json["total_sessions"], 1)
        self.assertIn("consistency_rating", metrics_json["shooting_angle"])
        self.assertEqual(len(metrics_json["timeline"]), 1)

        # 6. Scout Registration and Athlete Talent Discovery
        scout_payload = {
            "email": "scout.mwangi@jrnbakenya.com",
            "password": "ScoutPassword123",
            "full_name": "Coach Peter Mwangi",
            "role": "scout",
            "organization": "M-PESA x Jr. NBA Grassroots Kenya",
            "title": "Lead Regional Scout",
        }
        res_scout = self.client.post("/api/auth/register", json=scout_payload)
        self.assertEqual(res_scout.status_code, 201)
        scout_token = res_scout.get_json()["token"]
        headers_scout = {"Authorization": f"Bearer {scout_token}"}

        # Scout searches for athletes in Kisumu County
        res_scout_search = self.client.get("/api/scout/athletes?county=Kisumu", headers=headers_scout)
        self.assertEqual(res_scout_search.status_code, 200)
        scout_athletes = res_scout_search.get_json()["athletes"]
        self.assertGreaterEqual(len(scout_athletes), 1)

        # Find our registered athlete in scout results
        matched = next((a for a in scout_athletes if a["id"] == athlete_id), None)
        self.assertIsNotNone(matched)
        self.assertEqual(matched["full_name"], "Victor Omondi")
        self.assertEqual(matched["profile"]["county"], "Kisumu")
        self.assertEqual(matched["performance"]["total_shots"], 1)
        self.assertIsNotNone(matched["performance"]["avg_shooting_angle"])
        self.assertIsNotNone(matched["performance"]["max_jump_height"])


class TestPipelineResilienceAndEdgeCases(unittest.TestCase):
    """
    Validates system resilience against bad inputs, invalid file types,
    pipeline execution failures, and zero-shot scenarios.
    """

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

        class TestConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
            UPLOAD_FOLDER = self.temp_dir

        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed athlete
        self.user = User(email="athlete.resilience@courtvision.ke", full_name="Amina Hassan", role="athlete")
        self.user.set_password("pass123")
        db.session.add(self.user)
        db.session.commit()

        self.profile = AthleteProfile(user_id=self.user.id, county="Mombasa", height_cm=185.0)
        db.session.add(self.profile)
        db.session.commit()

        # Get token
        from app.utils.auth_middleware import generate_token
        self.token = generate_token(self.user)
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_upload_rejected_for_disallowed_extension(self):
        # Disallowed file type .exe
        bad_file = (io.BytesIO(b"malicious executable binary"), "virus.exe")
        res = self.client.post(
            "/api/videos/upload",
            data={"video": bad_file},
            content_type="multipart/form-data",
            headers=self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid video file type", res.get_json()["error"])

    def test_upload_missing_video_field(self):
        res = self.client.post(
            "/api/videos/upload",
            data={"title": "Empty Upload"},
            content_type="multipart/form-data",
            headers=self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("No video file provided", res.get_json()["error"])

    @patch("app.cv.pipeline.extract_landmarks")
    def test_pipeline_catches_runtime_error_and_updates_status(self, mock_extract):
        # Create pending video
        video = Video(
            user_id=self.user.id,
            athlete_id=self.profile.id,
            title="Corrupted Stream Test",
            original_filename="corrupted.mp4",
            stored_filename="uuid_corrupted.mp4",
            file_path=str(Path(self.temp_dir) / "corrupted.mp4"),
            file_size_bytes=500,
            mime_type="video/mp4",
            status="pending",
        )
        db.session.add(video)
        db.session.commit()

        job = VideoProcessingJob(video_id=video.id, status="pending", stage="queued")
        db.session.add(job)
        db.session.commit()

        # Force pipeline exception (e.g. ffmpeg/opencv corrupted moov atom)
        mock_extract.side_effect = ValueError("Corrupted MP4 container: missing moov atom header")

        with self.assertRaises(ValueError):
            process_video_pipeline(video.id)

        # Database state verification
        db.session.refresh(video)
        db.session.refresh(job)
        self.assertEqual(video.status, "failed")
        self.assertEqual(job.status, "failed")
        self.assertIn("missing moov atom header", job.error_message)


class TestPipelinePerformanceAndLatency(unittest.TestCase):
    """
    Benchmarks feature extraction and XGBoost classifier latency
    to ensure real-time responsiveness for smartphone video processing.
    """

    def test_feature_computation_and_classifier_latency_benchmark(self):
        classifier = ShotClassifier.get_instance()
        self.assertIsNotNone(classifier.model)

        # Generate synthetic 90-frame landmark sequence (3-second clip)
        fps = 30.0
        n_frames = 90
        lms = np.zeros((n_frames, 33, 3), dtype=np.float32)
        lms[:, :, 2] = 0.90
        lms[:, 12, :2] = [300, 160] # shoulder
        lms[:, 14, :2] = [320, 210] # elbow
        lms[:, 16, :2] = [330, 130] # wrist
        lms[:, 24, :2] = [300, 280] # hip
        lms[:, 26, :2] = [305, 370] # knee
        lms[:, 28, :2] = [300, 460] # ankle

        release_t = 1.5
        athlete_height_cm = 190.0

        # Benchmark 50 iterations of feature extraction + classification
        iterations = 50
        start_time = time.perf_counter()

        for _ in range(iterations):
            feats, coverage = compute_features(
                lms=lms,
                fps=fps,
                release_time=release_t,
            )
            shot_type, conf = classifier.predict(feats)
            self.assertIn(shot_type, ["two_point", "three_point"])
            self.assertGreater(conf, 0.40)

        total_elapsed = time.perf_counter() - start_time
        avg_latency_ms = (total_elapsed / iterations) * 1000.0

        print(f"\n[BENCHMARK] 50 shot feature extractions + XGBoost classifications completed in {total_elapsed:.3f}s")
        print(f"[BENCHMARK] Average latency per shot analysis: {avg_latency_ms:.2f} ms")

        # Performance constraint: latency must be well under 100ms per shot
        self.assertLess(avg_latency_ms, 100.0, "Shot feature computation and classification exceeded 100ms budget!")


if __name__ == "__main__":
    unittest.main()
