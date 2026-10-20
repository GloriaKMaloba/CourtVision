"""
CourtVision Shot Classifier Benchmark & Evaluation Tool
Evaluates the trained XGBoost 2-point vs 3-point shooting classifier:
- Cross-validation and held-out test split accuracy, precision, recall, F1, ROC-AUC
- Confusion matrix
- Single-sample inference latency (p50, p95, min, max in milliseconds)
- Batch inference throughput (shots / second)
- Robustness to missing/NaN kinematic features
"""

import os
import sys
import time
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)

# Ensure backend directory is in python path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.cv.classifier import ShotClassifier, MODEL_PATH, FEATURE_ORDER_PATH

def run_benchmark():
    print("=" * 70)
    print("CourtVision™ - Shot Classifier Benchmark & Verification Suite")
    print("=" * 70)
    print(f"Model path:         {MODEL_PATH}")
    print(f"Feature order path: {FEATURE_ORDER_PATH}")

    # 1. Initialize classifier
    start_load = time.perf_counter()
    classifier = ShotClassifier.get_instance()
    load_time_ms = (time.perf_counter() - start_load) * 1000
    print(f"Model load time:    {load_time_ms:.2f} ms")
    print(f"Features ({len(classifier.features)}):   {', '.join(classifier.features[:6])}...")

    # 2. Load dataset
    data_dir = BACKEND_DIR / "ml" / "drive-download-20261017T165850Z-1-001"
    features_csv = data_dir / "shot_features.csv"
    splits_csv = data_dir / "shot_splits.csv"

    if not features_csv.exists() or not splits_csv.exists():
        print(f"\n[!] Dataset files not found at {data_dir}. Running synthetic benchmarks.")
        _run_synthetic_benchmarks(classifier)
        return

    df = pd.read_csv(features_csv)
    splits = pd.read_csv(splits_csv)
    df = df.merge(splits[["clip", "split", "fold"]], on="clip", how="left")

    trainval = df[df["split"] == "trainval"].reset_index(drop=True)
    test = df[df["split"] == "test"].reset_index(drop=True)

    print(f"\nDataset loaded: {len(df)} total annotated shots")
    print(f"  • Train/Val set: {len(trainval)} shots ({sum(trainval['is_3pt'] == 0)} 2pt, {sum(trainval['is_3pt'] == 1)} 3pt)")
    print(f"  • Test set:      {len(test)} shots ({sum(test['is_3pt'] == 0)} 2pt, {sum(test['is_3pt'] == 1)} 3pt)")

    # 3. Test Set Evaluation
    print("\n" + "-" * 70)
    print("Held-Out Test Set Performance (Evaluation on Unseen Videos)")
    print("-" * 70)

    test_preds = []
    test_probs = []
    test_rows = test.to_dict(orient="records")

    for r in test_rows:
        pred_label, conf = classifier.predict(r)
        test_preds.append(1 if pred_label == "three_point" else 0)
        # Prob of 3pt: if predicted 3pt, conf; else 1 - conf
        p3 = conf if pred_label == "three_point" else (1.0 - conf)
        test_probs.append(p3)

    y_test = test["is_3pt"].values
    test_preds = np.array(test_preds)
    test_probs = np.array(test_probs)

    acc = accuracy_score(y_test, test_preds)
    prec = precision_score(y_test, test_preds, zero_division=0)
    rec = recall_score(y_test, test_preds, zero_division=0)
    f1 = f1_score(y_test, test_preds, zero_division=0)
    auc = roc_auc_score(y_test, test_probs)
    cm = confusion_matrix(y_test, test_preds, labels=[0, 1])

    print(f"Accuracy:  {acc * 100:.2f}% ({sum(test_preds == y_test)}/{len(y_test)} correct)")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1-Score:  {f1:.4f}")
    print(f"ROC-AUC:   {auc:.4f}")

    print("\nConfusion Matrix (Rows: True, Cols: Predicted):")
    print("                Pred 2pt    Pred 3pt")
    print(f"  Actual 2pt:      {cm[0, 0]:2d}          {cm[0, 1]:2d}")
    print(f"  Actual 3pt:      {cm[1, 0]:2d}          {cm[1, 1]:2d}")

    # 4. Latency and Throughput Benchmarking
    print("\n" + "-" * 70)
    print("Inference Latency & Throughput Benchmarking")
    print("-" * 70)

    sample_dict = test_rows[0]

    # Warmup
    for _ in range(20):
        classifier.predict(sample_dict)

    # Single-sample inference benchmark (100 iterations)
    latencies = []
    for _ in range(100):
        t0 = time.perf_counter()
        classifier.predict(sample_dict)
        latencies.append((time.perf_counter() - t0) * 1000)

    p50 = np.percentile(latencies, 50)
    p95 = np.percentile(latencies, 95)
    p99 = np.percentile(latencies, 99)
    min_lat = np.min(latencies)
    max_lat = np.max(latencies)
    mean_lat = np.mean(latencies)

    print("Single Shot Inference Latency (100 repetitions):")
    print(f"  • Median (p50): {p50:.3f} ms")
    print(f"  • 95th % (p95): {p95:.3f} ms")
    print(f"  • 99th % (p99): {p99:.3f} ms")
    print(f"  • Mean ± Std:   {mean_lat:.3f} ± {np.std(latencies):.3f} ms")
    print(f"  • Min / Max:    {min_lat:.3f} ms / {max_lat:.3f} ms")

    # Batch throughput benchmark
    batch_size = len(test_rows)
    t_start = time.perf_counter()
    batch_results = classifier.predict_batch(test_rows) if hasattr(classifier, "predict_batch") else [classifier.predict(r) for r in test_rows]
    batch_time = time.perf_counter() - t_start
    throughput = batch_size / batch_time if batch_time > 0 else 0

    print(f"\nBatch Inference Throughput:")
    print(f"  • Batch of {batch_size} shots evaluated in {batch_time * 1000:.2f} ms")
    print(f"  • Throughput: {throughput:.1f} shots/second")

    # 5. Robustness to Missing / Degraded Landmark Data
    print("\n" + "-" * 70)
    print("Robustness & Missing Landmark Edge Cases")
    print("-" * 70)

    # Case A: Partial NaNs (e.g. wrist speed missing)
    partial_nan_dict = dict(sample_dict)
    partial_nan_dict["max_wrist_rise_speed"] = np.nan
    label_a, conf_a = classifier.predict(partial_nan_dict)
    print(f"1. Partial Missing Feature (wrist speed = NaN): -> {label_a} ({conf_a*100:.1f}%) [Handled gracefully]")

    # Case B: Multiple missing features
    multi_nan_dict = dict(sample_dict)
    for k in ["shoulder_angle", "elbow_angle", "wrist_above_head"]:
        multi_nan_dict[k] = None
    label_b, conf_b = classifier.predict(multi_nan_dict)
    print(f"2. Multiple Missing Features (3 landmarks = None): -> {label_b} ({conf_b*100:.1f}%) [Handled gracefully]")

    # Case C: Completely empty dictionary
    empty_dict = {}
    label_c, conf_c = classifier.predict(empty_dict)
    print(f"3. Completely Empty Feature Dict: -> {label_c} ({conf_c*100:.1f}%) [Safe fallback]")

    print("\n" + "=" * 70)
    print("Classifier benchmark completed successfully!")
    print("=" * 70)


def _run_synthetic_benchmarks(classifier):
    print("Running synthetic inference benchmark...")
    synthetic_features = {
        "elbow_angle": 125.0,
        "knee_angle": 110.0,
        "hip_angle": 135.0,
        "shoulder_angle": 80.0,
        "wrist_above_shoulder": 0.55,
        "wrist_above_head": 0.30,
        "forearm_lean": 12.0,
        "trunk_lean": 6.5,
        "min_knee_pre": 105.0,
        "knee_extension": 45.0,
        "t_min_knee_to_release": 0.38,
        "jump_at_release": 0.22,
        "jump_peak": 0.36,
        "max_knee_ext_speed": 340.0,
        "max_wrist_rise_speed": 11.2,
    }
    pred, conf = classifier.predict(synthetic_features)
    print(f"Synthetic Prediction: {pred} (confidence: {conf:.2f})")


if __name__ == "__main__":
    run_benchmark()
