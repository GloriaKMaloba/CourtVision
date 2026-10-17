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

        athlete_cards.append({
            "id": athlete.id,
            "full_name": athlete.full_name,
            "email": athlete.email,
            "created_at": athlete.created_at.isoformat() if athlete.created_at else None,
            "profile": athlete.athlete_profile.to_dict() if athlete.athlete_profile else None,
            "performance": {
                "total_videos": len(completed_videos),
                "total_shots": len(all_shots),
                "avg_shooting_angle": round(sum(angles) / len(angles), 1) if angles else None,
                "avg_jump_height": round(sum(jumps) / len(jumps), 1) if jumps else None,
                "max_jump_height": max(jumps) if jumps else None,
            },
            "latest_video": completed_videos[0].to_dict(include_shots=False) if completed_videos else None
        })

    return jsonify({
        "count": len(athlete_cards),
        "athletes": athlete_cards
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
                "total_shots": len(all_shots),
                "avg_shooting_angle": round(sum(angles) / len(angles), 1) if angles else None,
                "max_jump_height": max(jumps) if jumps else None,
            },
            "videos": videos_data,
        }
    }), 200
