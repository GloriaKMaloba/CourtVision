from datetime import datetime, timezone
from pathlib import Path
from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from app.models.user import db

health_bp = Blueprint("health", __name__, url_prefix="/api")

@health_bp.route("/health", methods=["GET"])
def health_check():
    db_status = "unknown"
    try:
        db.session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    upload_folder = Path(current_app.config["UPLOAD_FOLDER"])
    upload_status = "ready" if upload_folder.exists() and os_access(upload_folder) else "created"
    if not upload_folder.exists():
        upload_folder.mkdir(parents=True, exist_ok=True)
        upload_status = "created"

    return jsonify({
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "CourtVision Backend API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "status": db_status,
            "engine": str(db.engine.url).split("://")[0] if hasattr(db, "engine") else "unknown"
        },
        "uploads": {
            "status": upload_status,
            "path": str(upload_folder)
        }
    }), 200

def os_access(path: Path) -> bool:
    import os
    return os.access(path, os.W_OK)
