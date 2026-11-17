from pathlib import Path
from flask import Flask
from flask_cors import CORS
from app.config import Config
from app.models.user import db
import app.models # ensure all models are registered with SQLAlchemy

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.video import video_bp
    from app.routes.health import health_bp
    from app.routes.scout import scout_bp
    from app.routes.admin import admin_bp
    from app.routes.athlete import athlete_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(video_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(scout_bp)
    app.register_blueprint(scout_bp, url_prefix="/api/scouts", name="scouts_alias_bp")
    app.register_blueprint(admin_bp)
    app.register_blueprint(athlete_bp)
    app.register_blueprint(athlete_bp, url_prefix="/api/athlete", name="athlete_alias_bp")

    # Ensure uploads directory exists
    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    upload_folder.mkdir(parents=True, exist_ok=True)

    # Initialize database tables
    with app.app_context():
        db.create_all()

    return app
