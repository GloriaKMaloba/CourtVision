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


@video_bp.route("/<int:video_id>/results", methods=["GET"])
@jwt_required
def get_video_results(video_id: int):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    # Permission check: athlete can only view their own
    if g.current_user.role == "athlete" and video.user_id != g.current_user.id:
        return jsonify({"error": "Unauthorized to access this video"}), 403

    from app.models.metrics import ShotAnalysis
    import numpy as np

    shots = video.shots.order_by(ShotAnalysis.shot_index.asc()).all()
    shots_data = [s.to_dict() for s in shots]

    angles = [
        s["metric"]["shooting_angle_deg"]
        for s in shots_data
        if s.get("metric") and s["metric"].get("shooting_angle_deg") is not None
    ]
    jumps = [
        s["metric"]["jump_height_cm"]
        for s in shots_data
        if s.get("metric") and s["metric"].get("jump_height_cm") is not None
    ]
    releases = [
        s["metric"]["release_time_sec"]
        for s in shots_data
        if s.get("metric") and s["metric"].get("release_time_sec") is not None
    ]
    confs = [
        s["classification_confidence"]
        for s in shots_data
        if s.get("classification_confidence") is not None
    ]

    two_pts = [s for s in shots_data if s.get("shot_type") == "two_point"]
    three_pts = [s for s in shots_data if s.get("shot_type") == "three_point"]
    total = len(shots_data)

    angle_std = round(float(np.std(angles, ddof=1)), 2) if len(angles) > 1 else 0.0
    jump_std = round(float(np.std(jumps, ddof=1)), 2) if len(jumps) > 1 else 0.0
    rel_std = round(float(np.std(releases, ddof=1)), 2) if len(releases) > 1 else 0.0

    if angle_std <= 2.5:
        consistency_rating = "Elite Consistency"
    elif angle_std <= 4.0:
        consistency_rating = "High Consistency"
    elif angle_std <= 6.0:
        consistency_rating = "Moderate Consistency"
    else:
        consistency_rating = "Developing Consistency"

    summary = {
        "total_shots": total,
        "two_pointers": len(two_pts),
        "three_pointers": len(three_pts),
        "two_point_pct": round((len(two_pts) / total) * 100, 1) if total else 0.0,
        "three_point_pct": round((len(three_pts) / total) * 100, 1) if total else 0.0,
        "mean_confidence": round(float(np.mean(confs)), 3) if confs else None,
        "shooting_angle": {
            "mean": round(float(np.mean(angles)), 1) if angles else None,
            "std": angle_std,
            "min": round(float(min(angles)), 1) if angles else None,
            "max": round(float(max(angles)), 1) if angles else None,
            "consistency_rating": consistency_rating if total else "No Shots",
        },
        "jump_height_cm": {
            "mean": round(float(np.mean(jumps)), 1) if jumps else None,
            "std": jump_std,
            "min": round(float(min(jumps)), 1) if jumps else None,
            "max": round(float(max(jumps)), 1) if jumps else None,
        },
        "release_time_sec": {
            "mean": round(float(np.mean(releases)), 2) if releases else None,
            "std": rel_std,
        },
    }

    job = video.jobs.order_by(VideoProcessingJob.id.desc()).first()

    return jsonify({
        "video": {
            "id": video.id,
            "user_id": video.user_id,
            "athlete_id": video.athlete_id,
            "title": video.title,
            "status": video.status,
            "duration_seconds": video.duration_seconds,
            "fps": video.fps,
            "created_at": video.created_at.isoformat() if video.created_at else None,
        },
        "latest_job": job.to_dict() if job else None,
        "summary": summary,
        "shots": shots_data,
    }), 200


@video_bp.route("/<int:video_id>/status", methods=["GET"])
@jwt_required
def get_video_status(video_id: int):
    video = db.session.get(Video, video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    if g.current_user.role == "athlete" and video.user_id != g.current_user.id:
        return jsonify({"error": "Unauthorized to access this video"}), 403

    job = video.jobs.order_by(VideoProcessingJob.id.desc()).first()

    stage_progress = {
        "queued": 10,
        "pose_landmark_extraction": 35,
        "shot_detection": 65,
        "biomechanical_metric_extraction": 85,
        "metrics_persistence": 90,
        "done": 100,
    }

    status = video.status
    stage = job.stage if job else "queued"
    progress = 100 if status == "completed" else (0 if status == "failed" else stage_progress.get(stage, 25 if status == "processing" else 10))

    return jsonify({
        "video_id": video.id,
        "status": status,
        "stage": stage,
        "progress_percent": progress,
        "error_message": job.error_message if job else None,
        "started_at": job.started_at.isoformat() if job and job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job and job.completed_at else None,
        "shots_count": video.shots.count() if status == "completed" else 0,
    }), 200


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
