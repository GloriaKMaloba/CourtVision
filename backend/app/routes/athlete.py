import math
import numpy as np
from flask import Blueprint, request, jsonify, g
from app.models.user import db, User, AthleteProfile
from app.models.video import Video
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.utils.auth_middleware import jwt_required

athlete_bp = Blueprint("athletes", __name__, url_prefix="/api/athletes")


def _calculate_metrics_summary(videos):
    """
    Computes statistical aggregates (mean, std dev, min, max, distributions)
    and session-by-session history across a list of completed videos.
    """
    all_shots = []
    session_timeline = []

    for v in videos:
        shots = v.shots.order_by(ShotAnalysis.shot_index.asc()).all()
        if not shots:
            continue

        session_angles = [
            s.metric.shooting_angle_deg
            for s in shots
            if s.metric and s.metric.shooting_angle_deg is not None
        ]
        session_jumps = [
            s.metric.jump_height_cm
            for s in shots
            if s.metric and s.metric.jump_height_cm is not None
        ]
        session_releases = [
            s.metric.release_time_sec
            for s in shots
            if s.metric and s.metric.release_time_sec is not None
        ]
        session_2pt = sum(1 for s in shots if s.shot_type == "two_point")
        session_3pt = sum(1 for s in shots if s.shot_type == "three_point")

        std_angle = round(float(np.std(session_angles, ddof=1)), 2) if len(session_angles) > 1 else 0.0
        std_jump = round(float(np.std(session_jumps, ddof=1)), 2) if len(session_jumps) > 1 else 0.0

        session_timeline.append({
            "video_id": v.id,
            "title": v.title,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "shot_count": len(shots),
            "two_pointers": session_2pt,
            "three_pointers": session_3pt,
            "avg_shooting_angle": round(float(np.mean(session_angles)), 1) if session_angles else None,
            "std_shooting_angle": std_angle,
            "avg_jump_height": round(float(np.mean(session_jumps)), 1) if session_jumps else None,
            "std_jump_height": std_jump,
            "max_jump_height": round(float(max(session_jumps)), 1) if session_jumps else None,
            "avg_release_time": round(float(np.mean(session_releases)), 2) if session_releases else None,
        })

        all_shots.extend(shots)

    if not all_shots:
        return {
            "total_sessions": len(videos),
            "total_shots": 0,
            "two_pointers": 0,
            "three_pointers": 0,
            "two_point_pct": 0.0,
            "three_point_pct": 0.0,
            "shooting_angle": {
                "mean": None,
                "std": None,
                "min": None,
                "max": None,
                "consistency_rating": "No Data",
            },
            "jump_height_cm": {
                "mean": None,
                "std": None,
                "min": None,
                "max": None,
            },
            "release_time_sec": {
                "mean": None,
                "std": None,
            },
            "timeline": session_timeline,
        }

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
    releases = [
        s.metric.release_time_sec
        for s in all_shots
        if s.metric and s.metric.release_time_sec is not None
    ]
    confs = [
        s.classification_confidence
        for s in all_shots
        if s.classification_confidence is not None
    ]

    two_pt_count = sum(1 for s in all_shots if s.shot_type == "two_point")
    three_pt_count = sum(1 for s in all_shots if s.shot_type == "three_point")
    total_shots = len(all_shots)

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

    return {
        "total_sessions": len(videos),
        "total_shots": total_shots,
        "two_pointers": two_pt_count,
        "three_pointers": three_pt_count,
        "two_point_pct": round((two_pt_count / total_shots) * 100, 1) if total_shots else 0.0,
        "three_point_pct": round((three_pt_count / total_shots) * 100, 1) if total_shots else 0.0,
        "mean_confidence": round(float(np.mean(confs)), 3) if confs else None,
        "shooting_angle": {
            "mean": round(float(np.mean(angles)), 1) if angles else None,
            "std": angle_std,
            "min": round(float(min(angles)), 1) if angles else None,
            "max": round(float(max(angles)), 1) if angles else None,
            "consistency_rating": consistency_rating,
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
        "timeline": session_timeline,
    }


@athlete_bp.route("/me/metrics", methods=["GET"])
@jwt_required
def get_my_metrics():
    """Returns aggregated metrics for the authenticated athlete."""
    if g.current_user.role != "athlete":
        return jsonify({"error": "Only athletes have individual athlete metric portfolios"}), 403

    videos = Video.query.filter_by(user_id=g.current_user.id, status="completed").order_by(Video.created_at.asc()).all()
    metrics = _calculate_metrics_summary(videos)

    return jsonify({
        "athlete": {
            "id": g.current_user.id,
            "full_name": g.current_user.full_name,
            "email": g.current_user.email,
            "profile": g.current_user.athlete_profile.to_dict() if g.current_user.athlete_profile else None,
        },
        "metrics": metrics,
    }), 200


@athlete_bp.route("/<int:athlete_id>/metrics", methods=["GET"])
@jwt_required
def get_athlete_metrics(athlete_id: int):
    """
    Returns aggregated metrics for a specified athlete ID.
    Accessible by scouts, admins, or the athlete themselves.
    """
    # Permission check
    if g.current_user.role == "athlete" and g.current_user.id != athlete_id:
        return jsonify({"error": "Unauthorized to access another athlete's detailed metrics"}), 403

    athlete = User.query.filter_by(id=athlete_id, role="athlete").first()
    if not athlete:
        return jsonify({"error": "Athlete not found"}), 404

    videos = Video.query.filter_by(user_id=athlete.id, status="completed").order_by(Video.created_at.asc()).all()
    metrics = _calculate_metrics_summary(videos)

    return jsonify({
        "athlete": {
            "id": athlete.id,
            "full_name": athlete.full_name,
            "email": athlete.email,
            "profile": athlete.athlete_profile.to_dict() if athlete.athlete_profile else None,
        },
        "metrics": metrics,
    }), 200
