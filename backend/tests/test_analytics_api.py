import sys
import unittest
from pathlib import Path

# Ensure backend directory is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from app.config import Config
from app.models.user import db, User, AthleteProfile, ScoutProfile
from app.models.video import Video
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.utils.auth_middleware import generate_token


class TestAnalyticsAPI(unittest.TestCase):
    def setUp(self):
        class TestConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

        self.app = create_app(TestConfig)


        self.client = self.app.test_client()

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create athlete 1
        athlete1 = User(email="shooter1@courtvision.ke", full_name="Kevin Otieno", role="athlete")
        athlete1.set_password("pass123")
        db.session.add(athlete1)
        db.session.commit()

        prof1 = AthleteProfile(user_id=athlete1.id, county="Kisumu", position="Shooting Guard", height_cm=188.0)
        db.session.add(prof1)

        # Create athlete 2
        athlete2 = User(email="shooter2@courtvision.ke", full_name="Brian Kiprop", role="athlete")
        athlete2.set_password("pass123")
        db.session.add(athlete2)
        db.session.commit()

        prof2 = AthleteProfile(user_id=athlete2.id, county="Eldoret", position="Point Guard", height_cm=182.0)
        db.session.add(prof2)

        # Create scout
        scout = User(email="scout1@courtvision.ke", full_name="Coach Achieng", role="scout")
        scout.set_password("pass123")
        db.session.add(scout)
        db.session.commit()

        scout_prof = ScoutProfile(user_id=scout.id, organization="Jr. NBA Kenya", title="Lead Scout")
        db.session.add(scout_prof)
        db.session.commit()

        self.athlete1 = athlete1
        self.athlete2 = athlete2
        self.scout = scout

        self.token_athlete1 = generate_token(athlete1)
        self.token_athlete2 = generate_token(athlete2)
        self.token_scout = generate_token(scout)

        # Seed 2 completed video sessions for athlete 1
        vid1 = Video(
            user_id=athlete1.id,
            athlete_id=prof1.id,
            title="Morning Midrange Session",
            original_filename="midrange.mp4",
            stored_filename="u1_midrange.mp4",
            file_path="/tmp/u1.mp4",
            file_size_bytes=10000,
            status="completed",
        )
        db.session.add(vid1)
        db.session.flush()

        s1 = ShotAnalysis(video_id=vid1.id, shot_index=1, timestamp_start=1.0, timestamp_release=1.5, timestamp_end=2.0, shot_type="two_point", classification_confidence=0.91)
        db.session.add(s1)
        db.session.flush()
        db.session.add(PerformanceMetric(shot_analysis_id=s1.id, shooting_angle_deg=124.0, jump_height_cm=42.0, release_time_sec=0.42))

        s2 = ShotAnalysis(video_id=vid1.id, shot_index=2, timestamp_start=3.0, timestamp_release=3.6, timestamp_end=4.2, shot_type="two_point", classification_confidence=0.88)
        db.session.add(s2)
        db.session.flush()
        db.session.add(PerformanceMetric(shot_analysis_id=s2.id, shooting_angle_deg=126.0, jump_height_cm=44.0, release_time_sec=0.45))

        vid2 = Video(
            user_id=athlete1.id,
            athlete_id=prof1.id,
            title="Arc Three Point Practice",
            original_filename="threes.mp4",
            stored_filename="u2_threes.mp4",
            file_path="/tmp/u2.mp4",
            file_size_bytes=10000,
            status="completed",
        )
        db.session.add(vid2)
        db.session.flush()

        s3 = ShotAnalysis(video_id=vid2.id, shot_index=1, timestamp_start=1.2, timestamp_release=1.8, timestamp_end=2.5, shot_type="three_point", classification_confidence=0.95)
        db.session.add(s3)
        db.session.flush()
        db.session.add(PerformanceMetric(shot_analysis_id=s3.id, shooting_angle_deg=132.0, jump_height_cm=50.0, release_time_sec=0.50))

        db.session.commit()
        self.vid1 = vid1
        self.vid2 = vid2

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_athlete_me_metrics(self):
        res = self.client.get("/api/athletes/me/metrics", headers={"Authorization": f"Bearer {self.token_athlete1}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertEqual(data["athlete"]["id"], self.athlete1.id)
        metrics = data["metrics"]
        self.assertEqual(metrics["total_sessions"], 2)
        self.assertEqual(metrics["total_shots"], 3)
        self.assertEqual(metrics["two_pointers"], 2)
        self.assertEqual(metrics["three_pointers"], 1)
        self.assertAlmostEqual(metrics["two_point_pct"], 66.7, places=1)
        self.assertAlmostEqual(metrics["three_point_pct"], 33.3, places=1)

        # Average angles (124, 126, 132) -> mean 127.3
        self.assertAlmostEqual(metrics["shooting_angle"]["mean"], 127.3, places=1)
        self.assertGreater(metrics["shooting_angle"]["std"], 0)
        self.assertIn("Consistency", metrics["shooting_angle"]["consistency_rating"])

        # Jumps (42, 44, 50) -> max 50.0, mean 45.3
        self.assertEqual(metrics["jump_height_cm"]["max"], 50.0)
        self.assertAlmostEqual(metrics["jump_height_cm"]["mean"], 45.3, places=1)

        # Timeline has 2 sessions
        self.assertEqual(len(metrics["timeline"]), 2)
        self.assertEqual(metrics["timeline"][0]["title"], "Morning Midrange Session")
        self.assertEqual(metrics["timeline"][0]["shot_count"], 2)
        self.assertEqual(metrics["timeline"][1]["title"], "Arc Three Point Practice")
        self.assertEqual(metrics["timeline"][1]["shot_count"], 1)

    def test_athlete_metrics_permissions(self):
        # Athlete 2 tries to access Athlete 1's metrics -> 403 Forbidden
        res = self.client.get(f"/api/athletes/{self.athlete1.id}/metrics", headers={"Authorization": f"Bearer {self.token_athlete2}"})
        self.assertEqual(res.status_code, 403)

        # Scout accesses Athlete 1's metrics -> 200 OK
        res_scout = self.client.get(f"/api/athletes/{self.athlete1.id}/metrics", headers={"Authorization": f"Bearer {self.token_scout}"})
        self.assertEqual(res_scout.status_code, 200)

        # Non-existent athlete -> 404
        res_404 = self.client.get("/api/athletes/9999/metrics", headers={"Authorization": f"Bearer {self.token_scout}"})
        self.assertEqual(res_404.status_code, 404)

    def test_video_results_endpoint(self):
        res = self.client.get(f"/api/videos/{self.vid1.id}/results", headers={"Authorization": f"Bearer {self.token_athlete1}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("video", data)
        self.assertIn("summary", data)
        self.assertIn("shots", data)

        self.assertEqual(data["video"]["id"], self.vid1.id)
        self.assertEqual(data["summary"]["total_shots"], 2)
        self.assertEqual(data["summary"]["two_pointers"], 2)
        self.assertEqual(data["summary"]["three_pointers"], 0)
        self.assertEqual(data["summary"]["jump_height_cm"]["max"], 44.0)

        shots = data["shots"]
        self.assertEqual(len(shots), 2)
        self.assertEqual(shots[0]["shot_type"], "two_point")
        self.assertEqual(shots[0]["metric"]["shooting_angle_deg"], 124.0)
        self.assertEqual(shots[1]["metric"]["jump_height_cm"], 44.0)

    def test_scout_athletes_filtering_and_pagination(self):
        # 1. Test pagination metadata
        res = self.client.get("/api/scout/athletes?page=1&per_page=1", headers={"Authorization": f"Bearer {self.token_scout}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["per_page"], 1)
        self.assertEqual(data["count"], 1)
        self.assertGreaterEqual(data["total"], 2)
        self.assertGreaterEqual(data["total_pages"], 2)

        # 2. Test alias route /api/scouts/athletes
        res_alias = self.client.get("/api/scouts/athletes", headers={"Authorization": f"Bearer {self.token_scout}"})
        self.assertEqual(res_alias.status_code, 200)

        # 3. Test county filter
        res_county = self.client.get("/api/scout/athletes?county=Kisumu", headers={"Authorization": f"Bearer {self.token_scout}"})
        self.assertEqual(res_county.status_code, 200)
        athletes = res_county.get_json()["athletes"]
        self.assertTrue(all(a["profile"]["county"] == "Kisumu" for a in athletes))

        # 4. Test min_jump filter (Athlete 1 has max jump 50cm, Athlete 2 has 0)
        res_jump = self.client.get("/api/scout/athletes?min_jump=45", headers={"Authorization": f"Bearer {self.token_scout}"})
        self.assertEqual(res_jump.status_code, 200)
        jump_athletes = res_jump.get_json()["athletes"]
        self.assertEqual(len(jump_athletes), 1)
        self.assertEqual(jump_athletes[0]["id"], self.athlete1.id)


if __name__ == "__main__":
    unittest.main()
