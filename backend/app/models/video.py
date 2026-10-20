from datetime import datetime, timezone
from app.models.user import db

class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    title = db.Column(db.String(200), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), unique=True, nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size_bytes = db.Column(db.BigInteger, nullable=False)
    mime_type = db.Column(db.String(100), nullable=True)
    duration_seconds = db.Column(db.Float, nullable=True)
    fps = db.Column(db.Float, nullable=True)
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(30), nullable=False, default="pending", index=True)  # pending, processing, completed, failed
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    jobs = db.relationship("VideoProcessingJob", backref="video", cascade="all, delete-orphan", lazy="dynamic")
    shots = db.relationship("ShotAnalysis", backref="video", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self, include_shots: bool = False) -> dict:
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "athlete_id": self.athlete_id,
            "title": self.title,
            "original_filename": self.original_filename,
            "file_size_bytes": self.file_size_bytes,
            "file_size_mb": round(self.file_size_bytes / (1024 * 1024), 2),
            "mime_type": self.mime_type,
            "duration_seconds": self.duration_seconds,
            "fps": self.fps,
            "width": self.width,
            "height": self.height,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_shots:
            from app.models.metrics import ShotAnalysis
            shots_list = [shot.to_dict() for shot in self.shots.order_by(ShotAnalysis.shot_index).all()]
            data["shots"] = shots_list
            if shots_list:
                angles = [s["metric"]["shooting_angle_deg"] for s in shots_list if s.get("metric") and s["metric"].get("shooting_angle_deg") is not None]
                jumps = [s["metric"]["jump_height_cm"] for s in shots_list if s.get("metric") and s["metric"].get("jump_height_cm") is not None]
                two_pts = [s for s in shots_list if s.get("shot_type") == "two_point"]
                three_pts = [s for s in shots_list if s.get("shot_type") == "three_point"]
                data["summary"] = {
                    "total_shots": len(shots_list),
                    "two_pointers": len(two_pts),
                    "three_pointers": len(three_pts),
                    "avg_shooting_angle": round(sum(angles) / len(angles), 1) if angles else None,
                    "avg_jump_height": round(sum(jumps) / len(jumps), 1) if jumps else None,
                    "max_jump_height": max(jumps) if jumps else None,
                }
            else:
                data["summary"] = None
        return data


class VideoProcessingJob(db.Model):
    __tablename__ = "video_processing_jobs"

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    status = db.Column(db.String(30), nullable=False, default="pending") # pending, processing, completed, failed
    stage = db.Column(db.String(50), nullable=True) # frame_extraction, ball_detection, pose_estimation, classification, metrics
    error_message = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "video_id": self.video_id,
            "status": self.status,
            "stage": self.stage,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
