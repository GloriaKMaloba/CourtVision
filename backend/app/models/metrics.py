from datetime import datetime, timezone
from app.models.user import db

class ShotAnalysis(db.Model):
    __tablename__ = "shot_analyses"

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    shot_index = db.Column(db.Integer, nullable=False, default=1)
    timestamp_start = db.Column(db.Float, nullable=True) # start of shot motion (seconds)
    timestamp_release = db.Column(db.Float, nullable=True) # ball leaves fingertips (seconds)
    timestamp_end = db.Column(db.Float, nullable=True) # landing / ball at rim (seconds)
    shot_type = db.Column(db.String(30), nullable=True) # 'two_point' or 'three_point'
    classification_confidence = db.Column(db.Float, nullable=True) # Random forest probability
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # 1-to-1 relationship with PerformanceMetric
    metric = db.relationship("PerformanceMetric", backref="shot_analysis", uselist=False, cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "video_id": self.video_id,
            "shot_index": self.shot_index,
            "timestamp_start": self.timestamp_start,
            "timestamp_release": self.timestamp_release,
            "timestamp_end": self.timestamp_end,
            "shot_type": self.shot_type,
            "classification_confidence": self.classification_confidence,
            "metric": self.metric.to_dict() if self.metric else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PerformanceMetric(db.Model):
    __tablename__ = "performance_metrics"

    id = db.Column(db.Integer, primary_key=True)
    shot_analysis_id = db.Column(db.Integer, db.ForeignKey("shot_analyses.id", ondelete="CASCADE"), unique=True, nullable=False)
    shooting_angle_deg = db.Column(db.Float, nullable=True) # angle at release in degrees
    jump_height_cm = db.Column(db.Float, nullable=True) # vertical displacement in cm
    release_time_sec = db.Column(db.Float, nullable=True) # time from initiation to release
    release_height_relative = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "shot_analysis_id": self.shot_analysis_id,
            "shooting_angle_deg": self.shooting_angle_deg,
            "jump_height_cm": self.jump_height_cm,
            "release_time_sec": self.release_time_sec,
            "release_height_relative": self.release_height_relative,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
