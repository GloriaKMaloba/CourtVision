from flask import Blueprint, request, jsonify, g
from app.models.user import db, User, AthleteProfile, ScoutProfile
from app.models.video import Video, VideoProcessingJob
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.utils.auth_middleware import role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/stats", methods=["GET"])
@role_required(["admin"])
def get_system_stats():
    total_users = User.query.count()
    athletes_count = User.query.filter_by(role="athlete").count()
    scouts_count = User.query.filter_by(role="scout").count()
    admins_count = User.query.filter_by(role="admin").count()

    total_videos = Video.query.count()
    completed_videos = Video.query.filter_by(status="completed").count()
    processing_videos = Video.query.filter_by(status="processing").count()
    failed_videos = Video.query.filter_by(status="failed").count()
    pending_videos = Video.query.filter_by(status="pending").count()

    total_shots = ShotAnalysis.query.count()

    # Calculate system averages
    metrics = PerformanceMetric.query.all()
    angles = [m.shooting_angle_deg for m in metrics if m.shooting_angle_deg is not None]
    jumps = [m.jump_height_cm for m in metrics if m.jump_height_cm is not None]

    return jsonify({
        "users": {
            "total": total_users,
            "athletes": athletes_count,
            "scouts": scouts_count,
            "admins": admins_count,
        },
        "videos": {
            "total": total_videos,
            "completed": completed_videos,
            "processing": processing_videos,
            "failed": failed_videos,
            "pending": pending_videos,
        },
        "shots": {
            "total": total_shots,
            "avg_shooting_angle": round(sum(angles) / len(angles), 1) if angles else None,
            "max_jump_height": max(jumps) if jumps else None,
        }
    }), 200


@admin_bp.route("/users", methods=["GET"])
@role_required(["admin"])
def list_users():
    role_filter = request.args.get("role", "").strip()
    search = request.args.get("search", "").strip().lower()

    query = User.query

    if role_filter:
        query = query.filter_by(role=role_filter)

    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    users = query.order_by(User.created_at.desc()).all()

    users_data = []
    for u in users:
        u_dict = u.to_dict(include_profile=True)
        u_dict["video_count"] = u.videos.count()
        users_data.append(u_dict)

    return jsonify({
        "count": len(users_data),
        "users": users_data
    }), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@role_required(["admin"])
def delete_user(user_id: int):
    if g.current_user.id == user_id:
        return jsonify({"error": "You cannot delete your own admin account."}), 400

    user_to_delete = User.query.get(user_id)
    if not user_to_delete:
        return jsonify({"error": "User not found."}), 404

    user_name = user_to_delete.full_name
    db.session.delete(user_to_delete)
    db.session.commit()

    return jsonify({
        "message": f"User '{user_name}' and all associated records have been deleted."
    }), 200
