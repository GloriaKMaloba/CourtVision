import time
import numpy as np
from datetime import datetime, timezone
from app.models.user import db, AthleteProfile
from app.models.video import Video, VideoProcessingJob
from app.models.metrics import ShotAnalysis, PerformanceMetric
from app.cv.pose import extract_landmarks, find_shots_in_video
from app.cv.features import compute_features
from app.cv.classifier import classify_shot

def process_video_pipeline(video_id: int) -> dict:
    """
    Executes the end-to-end computer vision processing on an uploaded video:
    1. Landmark extraction using MediaPipe Pose (accelerated)
    2. Automatic shot detection and temporal framing
    3. Biomechanical feature extraction (15 tabular features)
    4. XGBoost shot classification (2-point vs 3-point)
    5. Persistence of discrete shots and performance metrics to database
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
        job.progress_percent = 50
        job.started_at = datetime.now(timezone.utc)
        db.session.commit()

        # Step 1: MediaPipe landmark extraction with live progress tracking
        def _on_progress(pct):
            try:
                job.progress_percent = int(pct)
                db.session.commit()
            except Exception:
                db.session.rollback()

        lms, fps, width, height, duration = extract_landmarks(
            video.file_path,
            max_width=480,
            target_fps=20.0,
            max_duration_sec=90.0,
            progress_callback=_on_progress
        )
        video.fps = fps
        video.width = width
        video.height = height
        video.duration_seconds = duration

        if len(lms) == 0:
            raise ValueError("No frames or poses could be extracted from video")

        # Step 2: Automatic shot detection
        job.stage = "shot_detection"
        job.progress_percent = 92
        db.session.commit()
        found_shots = find_shots_in_video(lms, fps)

        # Clear any prior analyses for idempotent re-runs
        for prior_shot in video.shots.all():
            db.session.delete(prior_shot)
        db.session.flush()

        # Determine athlete torso length in cm for absolute jump height calibration
        torso_cm = 48.0  # youth/default baseline (48 cm)
        athlete_profile = None
        if video.athlete_id:
            athlete_profile = db.session.get(AthleteProfile, video.athlete_id)
        elif video.uploader and video.uploader.athlete_profile:
            athlete_profile = video.uploader.athlete_profile

        if athlete_profile and athlete_profile.height_cm:
            # Torso accounts for ~28% of standing height
            torso_cm = round(athlete_profile.height_cm * 0.28, 1)

        # Step 3: Biomechanical feature extraction & classification per shot
        job.stage = "biomechanical_metric_extraction"
        job.progress_percent = 95
        db.session.commit()

        parsed_shot_events = []
        for idx, shot_info in enumerate(found_shots, start=1):
            rel_t = shot_info["release_t"]
            peak_t = shot_info["peak_t"]

            # 4-second window centered around release
            a = max(0, int(round((rel_t - 2.0) * fps)))
            b = min(len(lms), int(round((rel_t + 2.0) * fps)))

            feats, cov = compute_features(lms[a:b], fps, rel_t - (a / fps))

            # If tracking was degraded, use safe defaults
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

            wrist_rel = feats.get("wrist_above_shoulder", 0.65)
            if wrist_rel is None or np.isnan(wrist_rel):
                wrist_rel = 0.65

            parsed_shot_events.append({
                "shot_index": idx,
                "timestamp_start": t_start,
                "timestamp_release": t_release,
                "timestamp_end": t_end,
                "shot_type": shot_type,
                "confidence": conf,
                "shooting_angle_deg": shooting_angle,
                "jump_height_cm": jump_cm,
                "release_time_sec": round(t_dip, 2),
                "release_height_relative": round(float(wrist_rel), 2),
            })

        # Step 4: Persist shots and performance metrics
        job.stage = "metrics_persistence"
        job.progress_percent = 98
        db.session.commit()

        analyzed_shots = []
        for shot_data in parsed_shot_events:
            shot_analysis = ShotAnalysis(
                video_id=video.id,
                shot_index=shot_data["shot_index"],
                timestamp_start=shot_data["timestamp_start"],
                timestamp_release=shot_data["timestamp_release"],
                timestamp_end=shot_data["timestamp_end"],
                shot_type=shot_data["shot_type"],
                classification_confidence=shot_data["confidence"],
            )
            db.session.add(shot_analysis)
            db.session.flush()

            metric = PerformanceMetric(
                shot_analysis_id=shot_analysis.id,
                shooting_angle_deg=shot_data["shooting_angle_deg"],
                jump_height_cm=shot_data["jump_height_cm"],
                release_time_sec=shot_data["release_time_sec"],
                release_height_relative=shot_data["release_height_relative"],
            )
            db.session.add(metric)

            analyzed_shots.append({
                "shot_number": shot_data["shot_index"],
                "release_time": shot_data["timestamp_release"],
                "shot_type": shot_data["shot_type"],
                "confidence": shot_data["confidence"],
                "shooting_angle_deg": shot_data["shooting_angle_deg"],
                "jump_height_cm": shot_data["jump_height_cm"],
            })

        # Finalize job status
        video.status = "completed"
        job.status = "completed"
        job.stage = "done"
        job.progress_percent = 100
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()

        return {
            "status": "completed",
            "video_id": video.id,
            "shots_detected": len(analyzed_shots),
            "shots": analyzed_shots,
            "duration_seconds": duration,
        }

    except Exception as e:
        db.session.rollback()
        video.status = "failed"
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        raise e
