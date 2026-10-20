import math
import numpy as np
from flask import Blueprint, request, jsonify, g
from app.models.user import User, AthleteProfile
from app.models.video import Video
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.utils.auth_middleware import role_required

scout_bp = Blueprint("scout", __name__, url_prefix="/api/scout")

@scout_bp.route("/athletes", methods=["GET"])
@role_required(["scout", "admin"])
def list_athletes():
    county = request.args.get("county", "").strip()
    position = request.args.get("position", "").strip()
    search = request.args.get("search", "").strip().lower()

    # Numeric metric filters
    min_jump = request.args.get("min_jump", type=float)
    min_angle = request.args.get("min_angle", type=float)
    max_angle = request.args.get("max_angle", type=float)

    # Pagination
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    page = max(1, page)
    per_page = max(1, min(100, per_page))

    query = User.query.filter_by(role="athlete").join(AthleteProfile, isouter=True)

    if county:
        query = query.filter(AthleteProfile.county.ilike(f"%{county}%"))

    if position:
        query = query.filter(AthleteProfile.position.ilike(f"%{position}%"))

    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (AthleteProfile.school_or_club.ilike(f"%{search}%"))
        )

    athletes = query.order_by(User.created_at.desc()).all()

    athlete_cards = []
    for athlete in athletes:
        # Compute performance summary from completed videos
        completed_videos = Video.query.filter_by(user_id=athlete.id, status="completed").all()
        all_shots = []
        for v in completed_videos:
            all_shots.extend(v.shots.all())

        angles = [
            s.metric.shooting_angle_deg
            for s in all_shots
            if s.metric and s.metric.shooting_angle_deg is not None
        ]
        jumps = [
            s.metric.jump_height_cm
            for s in all_shots
            if s.metric and s.metric.jump_height_cm is not None
        ]

        avg_angle = round(float(np.mean(angles)), 1) if angles else None
        avg_jump = round(float(np.mean(jumps)), 1) if jumps else None
        max_jump = round(float(max(jumps)), 1) if jumps else None
        angle_std = round(float(np.std(angles, ddof=1)), 2) if len(angles) > 1 else 0.0

        # Apply metric filters if specified
        if min_jump is not None:
            if max_jump is None or max_jump < min_jump:
                continue

        if min_angle is not None:
            if avg_angle is None or avg_angle < min_angle:
                continue

        if max_angle is not None:
            if avg_angle is None or avg_angle > max_angle:
                continue

        athlete_cards.append({
            "id": athlete.id,
            "full_name": athlete.full_name,
            "email": athlete.email,
            "created_at": athlete.created_at.isoformat() if athlete.created_at else None,
            "profile": athlete.athlete_profile.to_dict() if athlete.athlete_profile else None,
            "performance": {
                "total_videos": len(completed_videos),
                "total_shots": len(all_shots),
                "avg_shooting_angle": avg_angle,
                "std_shooting_angle": angle_std,
                "avg_jump_height": avg_jump,
                "max_jump_height": max_jump,
            },
            "latest_video": completed_videos[0].to_dict(include_shots=False) if completed_videos else None
        })

    total_athletes = len(athlete_cards)
    total_pages = max(1, math.ceil(total_athletes / per_page))
    start_idx = (page - 1) * per_page
    paginated_athletes = athlete_cards[start_idx : start_idx + per_page]

    return jsonify({
        "count": len(paginated_athletes),
        "total": total_athletes,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
        "athletes": paginated_athletes
    }), 200


@scout_bp.route("/athletes/<int:athlete_id>", methods=["GET"])
@role_required(["scout", "admin"])
def get_athlete_detail(athlete_id: int):
    athlete = User.query.filter_by(id=athlete_id, role="athlete").first()
    if not athlete:
        return jsonify({"error": "Athlete not found"}), 404

    videos = Video.query.filter_by(user_id=athlete.id).order_by(Video.created_at.desc()).all()
    videos_data = [v.to_dict(include_shots=True) for v in videos]

    all_shots = []
    for v in videos:
        if v.status == "completed":
            all_shots.extend([s.to_dict() for s in v.shots.all()])

    angles = [
        s["metric"]["shooting_angle_deg"]
        for s in all_shots
        if s.get("metric") and s["metric"].get("shooting_angle_deg") is not None
    ]
    jumps = [
        s["metric"]["jump_height_cm"]
        for s in all_shots
        if s.get("metric") and s["metric"].get("jump_height_cm") is not None
    ]
    two_pts = sum(1 for s in all_shots if s.get("shot_type") == "two_point")
    three_pts = sum(1 for s in all_shots if s.get("shot_type") == "three_point")
    total_shots = len(all_shots)

    angle_std = round(float(np.std(angles, ddof=1)), 2) if len(angles) > 1 else 0.0

    return jsonify({
        "athlete": {
            "id": athlete.id,
            "full_name": athlete.full_name,
            "email": athlete.email,
            "created_at": athlete.created_at.isoformat() if athlete.created_at else None,
            "profile": athlete.athlete_profile.to_dict() if athlete.athlete_profile else None,
            "summary": {
                "total_videos": len(videos),
                "completed_videos": len([v for v in videos if v.status == "completed"]),
                "total_shots": total_shots,
                "two_pointers": two_pts,
                "three_pointers": three_pts,
                "two_point_pct": round((two_pts / total_shots) * 100, 1) if total_shots else 0.0,
                "three_point_pct": round((three_pts / total_shots) * 100, 1) if total_shots else 0.0,
                "avg_shooting_angle": round(float(np.mean(angles)), 1) if angles else None,
                "std_shooting_angle": angle_std,
                "avg_jump_height": round(float(np.mean(jumps)), 1) if jumps else None,
                "max_jump_height": round(float(max(jumps)), 1) if jumps else None,
            },
            "videos": videos_data,
        }
    }), 200
