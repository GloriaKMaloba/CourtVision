import json
from pathlib import Path
import numpy as np
import xgboost as xgb

ML_DIR = Path(__file__).resolve().parent.parent.parent / "ml"
MODEL_PATH = str(ML_DIR / "xgb_shot_classifier.json")
FEATURE_ORDER_PATH = str(ML_DIR / "xgb_feature_order.json")

class ShotClassifier:
    _instance = None

    def __init__(self):
        self.model = xgb.XGBClassifier()
        self.model.load_model(MODEL_PATH)
        with open(FEATURE_ORDER_PATH, "r") as f:
            self.features = json.load(f)

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def predict(self, features_dict: dict) -> tuple[str, float]:
        """
        Takes a dict of features, returns (shot_type, confidence).
        shot_type is 'two_point' or 'three_point'.
        """
        if not features_dict:
            return "two_point", 0.50

        vec = []
        valid_count = 0
        for k in self.features:
            val = features_dict.get(k)
            if val is None or (isinstance(val, (int, float)) and np.isnan(val)):
                vec.append(np.nan)
            else:
                try:
                    num_val = float(val)
                    if np.isnan(num_val):
                        vec.append(np.nan)
                    else:
                        vec.append(num_val)
                        valid_count += 1
                except (ValueError, TypeError):
                    vec.append(np.nan)

        # If too few valid features, return safe baseline
        if valid_count < (len(self.features) // 2):
            return "two_point", 0.50

        X = np.array([vec], dtype=np.float32)
        prob_3pt = float(self.model.predict_proba(X)[0, 1])

        if prob_3pt >= 0.50:
            return "three_point", round(prob_3pt, 3)
        else:
            return "two_point", round(1.0 - prob_3pt, 3)

    def predict_batch(self, features_list: list[dict]) -> list[tuple[str, float]]:
        """
        Evaluates a batch of shot feature dictionaries and returns
        a list of (shot_type, confidence) tuples.
        """
        if not features_list:
            return []

        return [self.predict(f) for f in features_list]


def classify_shot(features_dict: dict) -> tuple[str, float]:
    classifier = ShotClassifier.get_instance()
    return classifier.predict(features_dict)
