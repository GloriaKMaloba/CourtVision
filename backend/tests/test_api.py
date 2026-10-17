import io
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
from app import create_app
from app.models.user import db, User

class TestCourtVisionAPI(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("status", data)
        self.assertEqual(data["database"]["status"], "connected")

    def test_athlete_login(self):
        res = self.client.post("/api/auth/login", json={
            "email": "athlete@courtvision.ke",
            "password": "password123"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["role"], "athlete")

    def test_video_upload_and_listing(self):
        # 1. Login
        login_res = self.client.post("/api/auth/login", json={
            "email": "athlete@courtvision.ke",
            "password": "password123"
        })
        token = login_res.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Upload dummy video
        dummy_video_data = (io.BytesIO(b"fake video content header and frames"), "test_drill.mp4")
        upload_res = self.client.post(
            "/api/videos/upload",
            headers=headers,
            data={
                "video": dummy_video_data,
                "title": "Three Point Practice",
                "notes": "Corner three shooting session"
            },
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_res.status_code, 201)
        upload_data = upload_res.get_json()
        video_id = upload_data["video"]["id"]
        self.assertEqual(upload_data["video"]["title"], "Three Point Practice")

        # 3. List videos
        list_res = self.client.get("/api/videos", headers=headers)
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.get_json()
        self.assertGreaterEqual(list_data["count"], 1)

        # 4. Get video details
        get_res = self.client.get(f"/api/videos/{video_id}", headers=headers)
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.get_json()["video"]["status"], "pending")

        # 5. Delete video
        del_res = self.client.delete(f"/api/videos/{video_id}", headers=headers)
        self.assertEqual(del_res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
