import time
import numpy as np
from datetime import datetime, timezone
from app.models.user import db
from app.models.video import Video, VideoProcessingJob
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.cv.pose import extract_landmarks, find_shots_in_video
from app.cv.features import compute_features
from app.cv.classifier import classify_shot

def process_video_pipeline(video_id: int) -> dict:
    """
    Executes the end-to-end computer vision processing on an uploaded video:
    1. Landmark extraction using MediaPipe
    2. Automatic shot detection and release framing
    3. 15-feature biomechanical extraction (jump peak, elbow angle, lean, etc.)
    4. XGBoost shot classification (2-point vs 3-point)
    5. Persistence to PostgreSQL/SQLite database
    """
    video = db.session.get(Video, video_id)
    if not video:
        raise ValueError(f"Video #{video_id} not found in database")

    job = video.jobs.order_by(VideoProcessingJob.id.desc()).first()
    if not job:
        job = VideoProcessingJob(video_id=video.id, status="processing")
        db.session.add(job)

    try:
        video.status = "processing"
        job.status = "processing"
        job.stage = "pose_landmark_extraction"
        job.started_at = datetime.now(timezone.utc)
        db.session.commit()

        # Step 1: MediaPipe landmark extraction
        lms, fps, width, height, duration = extract_landmarks(video.file_path)
        video.fps = fps
        video.width = width
        video.height = height
        video.duration_seconds = duration

        if len(lms) == 0:
            raise ValueError("No frames or poses could be extracted from video")

        # Step 2: Automatic shot detection
        job.stage = "shot_detection"
        db.session.commit()
        found_shots = find_shots_in_video(lms, fps)

        # Clear any prior analyses for idempotent re-runs
        video.shots.delete()
        db.session.commit()

        # Determine athlete torso length in cm for absolute jump height calibration
        torso_cm = 48.0  # standard youth baseline (48 cm)
        if video.uploader and video.uploader.athlete_profile and video.uploader.athlete_profile.height_cm:
            # Torso typically accounts for ~28% of standing height
            torso_cm = round(video.uploader.athlete_profile.height_cm * 0.28, 1)

        analyzed_shots = []

        # Step 3: Biomechanical feature extraction & classification per shot
        job.stage = "biomechanical_metric_extraction"
        db.session.commit()

        for idx, shot_info in enumerate(found_shots, start=1):
            rel_t = shot_info["release_t"]
            peak_t = shot_info["peak_t"]

            # 4-second window centered around release
            a = max(0, int(round((rel_t - 2.0) * fps)))
            b = min(len(lms), int(round((rel_t + 2.0) * fps)))

            feats, cov = compute_features(lms[a:b], fps, rel_t - (a / fps))

            # If tracking was lost, fallback to defaults
            elbow_angle = feats.get("elbow_angle")
            if elbow_angle is None or np.isnan(elbow_angle):
                elbow_angle = 125.0

            jump_peak_val = feats.get("jump_peak")
            if jump_peak_val is None or np.isnan(jump_peak_val):
                jump_peak_val = 0.35

            # Calculate jump height in cm (clamped to positive leap)
            jump_cm = round(max(0.0, float(jump_peak_val)) * torso_cm, 1)
            shooting_angle = round(float(elbow_angle), 1)

            # Classify shot (2pt vs 3pt) using trained XGBoost model
            shot_type, conf = classify_shot(feats)

            t_dip = feats.get("t_min_knee_to_release", 0.4)
            if t_dip is None or np.isnan(t_dip):
                t_dip = 0.4

            t_start = max(0.0, round(rel_t - t_dip, 2))
            t_release = round(rel_t, 2)
            t_end = round(peak_t + 0.6, 2)

            shot_analysis = ShotAnalysis(
                video_id=video.id,
                shot_index=idx,
                timestamp_start=t_start,
                timestamp_release=t_release,
                timestamp_end=t_end,
                shot_type=shot_type,
                classification_confidence=conf,
            )
            db.session.add(shot_analysis)
            db.session.flush()

            metric = PerformanceMetric(
                shot_analysis_id=shot_analysis.id,
                shooting_angle_deg=shooting_angle,
                jump_height_cm=jump_cm,
                release_time_sec=round(t_dip, 2),
                release_height_relative=round(float(feats.get("wrist_above_shoulder", 0.65)), 2),
            )
            db.session.add(metric)
            analyzed_shots.append({
                "shot_number": idx,
                "release_time": t_release,
                "shot_type": shot_type,
                "confidence": conf,
                "shooting_angle_deg": shooting_angle,
                "jump_height_cm": jump_cm,
            })

        video.status = "completed"
        job.status = "completed"
        job.stage = "done"
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()

        return {
            "video_id": video.id,
            "status": "completed",
            "shots_detected": len(analyzed_shots),
            "shots": analyzed_shots,
        }

    except Exception as e:
        db.session.rollback()
        video.status = "failed"
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        raise e
