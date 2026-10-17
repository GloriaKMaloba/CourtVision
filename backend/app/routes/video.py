import os
import uuid
from pathlib import Path
from flask import Blueprint, request, jsonify, g, current_app, send_from_directory
from werkzeug.utils import secure_filename
from app.models.user import db, User
from app.models.video import Video, VideoProcessingJob
from app.utils.auth_middleware import jwt_required

video_bp = Blueprint("videos", __name__, url_prefix="/api/videos")

def is_allowed_file(filename: str) -> bool:
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", {"mp4", "mov", "avi", "webm", "mkv"})
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed

@video_bp.route("/upload", methods=["POST"])
@jwt_required
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file provided in request (field 'video' is required)"}), 400

    file = request.files["video"]
    if file.filename == "":
        return jsonify({"error": "No file selected for upload"}), 400

    if not is_allowed_file(file.filename):
        allowed_list = ", ".join(current_app.config.get("ALLOWED_EXTENSIONS", []))
        return jsonify({"error": f"Invalid video file type. Allowed formats: {allowed_list}"}), 400

    safe_original_name = secure_filename(file.filename) or "footage.mp4"
    extension = safe_original_name.rsplit(".", 1)[-1].lower()
    unique_filename = f"{uuid.uuid4().hex}_{safe_original_name}"

    upload_folder = Path(current_app.config["UPLOAD_FOLDER"])
    upload_folder.mkdir(parents=True, exist_ok=True)
    destination_path = upload_folder / unique_filename

    try:
        file.save(str(destination_path))
        file_size = destination_path.stat().st_size

        title = request.form.get("title", "").strip() or safe_original_name.rsplit(".", 1)[0].replace("_", " ").title()
        notes = request.form.get("notes", "").strip() or None

        # Determine athlete ID
        athlete_id = None
        if g.current_user.role == "athlete" and g.current_user.athlete_profile:
            athlete_id = g.current_user.athlete_profile.id
        elif request.form.get("athlete_id"):
            try:
                athlete_id = int(request.form.get("athlete_id"))
            except ValueError:
                pass

        video = Video(
            user_id=g.current_user.id,
            athlete_id=athlete_id,
            title=title,
            original_filename=safe_original_name,
            stored_filename=unique_filename,
            file_path=str(destination_path),
            file_size_bytes=file_size,
            mime_type=file.content_type or f"video/{extension}",
            status="pending",
            notes=notes,
        )
        db.session.add(video)
        db.session.flush()

        # Enqueue processing job record
        job = VideoProcessingJob(
            video_id=video.id,
            status="pending",
            stage="queued",
        )
        db.session.add(job)
        db.session.commit()

        # Trigger CV processing pipeline in background thread
        app_obj = current_app._get_current_object()
        def _run_bg(vid_id):
            with app_obj.app_context():
                try:
                    from app.cv.pipeline import process_video_pipeline
                    process_video_pipeline(vid_id)
                except Exception as ex:
                    print(f"Background CV Error on video {vid_id}: {ex}")

        import threading
        threading.Thread(target=_run_bg, args=(video.id,), daemon=True).start()

        return jsonify({
            "message": "Video uploaded successfully and queued for processing",
            "video": video.to_dict(),
            "job": job.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        # Clean up file on disk if save/db commit failed
        if destination_path.exists():
            try:
                destination_path.unlink()
            except OSError:
                pass
        return jsonify({"error": f"Failed to upload video: {str(e)}"}), 500


@video_bp.route("/<int:video_id>/process", methods=["POST"])
@jwt_required
def trigger_processing(video_id: int):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    if g.current_user.role == "athlete" and video.user_id != g.current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    app_obj = current_app._get_current_object()
    def _run_bg(vid_id):
        with app_obj.app_context():
            try:
                from app.cv.pipeline import process_video_pipeline
                process_video_pipeline(vid_id)
            except Exception as ex:
                print(f"Manual CV Error on video {vid_id}: {ex}")

    import threading
    threading.Thread(target=_run_bg, args=(video.id,), daemon=True).start()

    return jsonify({"message": f"Processing started for video #{video_id}"}), 200


@video_bp.route("", methods=["GET"])
@jwt_required
def list_videos():
    user = g.current_user
    query = Video.query

    # Athletes only see their uploaded videos
    if user.role == "athlete":
        query = query.filter_by(user_id=user.id)
    else:
        # Scouts and admins can filter by athlete_id or status
        athlete_id = request.args.get("athlete_id")
        if athlete_id:
            query = query.filter_by(athlete_id=athlete_id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    videos = query.order_by(Video.created_at.desc()).all()
    return jsonify({
        "count": len(videos),
        "videos": [v.to_dict(include_shots=True) for v in videos]
    }), 200


@video_bp.route("/<int:video_id>", methods=["GET"])
@jwt_required
def get_video(video_id: int):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    # Permission check: athlete can only view their own
    if g.current_user.role == "athlete" and video.user_id != g.current_user.id:
        return jsonify({"error": "Unauthorized to access this video"}), 403

    include_shots = request.args.get("include_shots", "true").lower() == "true"
    job = video.jobs.order_by(VideoProcessingJob.id.desc()).first()

    data = video.to_dict(include_shots=include_shots)
    data["latest_job"] = job.to_dict() if job else None
    return jsonify({"video": data}), 200


@video_bp.route("/<int:video_id>/file", methods=["GET"])
@jwt_required
def serve_video_file(video_id: int):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    if g.current_user.role == "athlete" and video.user_id != g.current_user.id:
        return jsonify({"error": "Unauthorized to access this video"}), 403

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    return send_from_directory(upload_folder, video.stored_filename, mimetype=video.mime_type)


@video_bp.route("/<int:video_id>", methods=["DELETE"])
@jwt_required
def delete_video(video_id: int):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    if g.current_user.role != "admin" and video.user_id != g.current_user.id:
        return jsonify({"error": "Unauthorized to delete this video"}), 403

    try:
        file_path = Path(video.file_path)
        if file_path.exists():
            file_path.unlink()

        db.session.delete(video)
        db.session.commit()
        return jsonify({"message": "Video deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete video: {str(e)}"}), 500
