from app.routes.auth import auth_bp
from app.routes.video import video_bp
from app.routes.health import health_bp
from app.routes.scout import scout_bp
from app.routes.admin import admin_bp

__all__ = ["auth_bp", "video_bp", "health_bp", "scout_bp", "admin_bp"]
