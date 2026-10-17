import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "courtvision-secret-key-development-2026")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "courtvision-jwt-secret-key-2026")
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))

    # PostgreSQL URL or fallback to SQLite for local development
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Standardize postgres:// to postgresql:// for SQLAlchemy compatibility
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        SQLALCHEMY_DATABASE_URI = database_url
    else:
        sqlite_path = BASE_DIR / "courtvision.db"
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{sqlite_path.as_posix()}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Video uploads
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads" / "videos"))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 500 * 1024 * 1024)) # 500 MB
    ALLOWED_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm", "m4v"}
