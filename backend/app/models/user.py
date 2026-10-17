from datetime import datetime, timezone
import bcrypt
from flask_sqlalchemy import SQLAlchemy

# SQLAlchemy instance shared across models
db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="athlete") # 'athlete', 'scout', 'admin'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    athlete_profile = db.relationship("AthleteProfile", backref="user", uselist=False, cascade="all, delete-orphan")
    scout_profile = db.relationship("ScoutProfile", backref="user", uselist=False, cascade="all, delete-orphan")
    videos = db.relationship("Video", backref="uploader", lazy="dynamic", cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self, include_profile: bool = True) -> dict:
        data = {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_profile:
            if self.role == "athlete" and self.athlete_profile:
                data["profile"] = self.athlete_profile.to_dict()
            elif self.role == "scout" and self.scout_profile:
                data["profile"] = self.scout_profile.to_dict()
            else:
                data["profile"] = None
        return data


class AthleteProfile(db.Model):
    __tablename__ = "athlete_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    county = db.Column(db.String(80), nullable=True) # e.g. Nairobi, Kisumu, Mombasa, Eldoret
    school_or_club = db.Column(db.String(150), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    position = db.Column(db.String(50), nullable=True) # Point Guard, Shooting Guard, etc.
    dominant_hand = db.Column(db.String(20), nullable=True) # Right, Left
    bio = db.Column(db.Text, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "county": self.county,
            "school_or_club": self.school_or_club,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "height_cm": self.height_cm,
            "position": self.position,
            "dominant_hand": self.dominant_hand,
            "bio": self.bio,
        }


class ScoutProfile(db.Model):
    __tablename__ = "scout_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization = db.Column(db.String(150), nullable=True) # e.g. Jr. NBA, M-PESA Foundation
    title = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(50), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "organization": self.organization,
            "title": self.title,
            "phone": self.phone,
        }
