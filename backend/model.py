"""Reproducible benign-only training and reusable CSV preprocessing."""
from dataclasses import dataclass
from io import BytesIO
import csv

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline

FEATURES = ["Flow Duration", "Total Fwd Packets", "Total Backward Packets",
            "Flow Bytes/s", "Flow Packets/s", "SYN Flag Count", "Destination Port"]
MAX_ROWS = 50_000
DISCLAIMER = "An anomaly is not proof of an attack. Feature comparisons are supporting evidence, not a causal explanation of the model."


class DataError(ValueError):
    pass


def read_csv(content: bytes) -> pd.DataFrame:
    try:
        # Check the original header: pandas otherwise silently renames duplicates.
        header = next(csv.reader(content.decode("utf-8-sig").splitlines()))
        names = [name.strip() for name in header]
        if len(set(names)) != len(names):
            raise DataError("CSV column names must be unique after trimming whitespace.")
        frame = pd.read_csv(BytesIO(content), encoding="utf-8-sig", nrows=MAX_ROWS + 1)
    except (UnicodeError, pd.errors.ParserError, pd.errors.EmptyDataError, StopIteration) as exc:
        raise DataError("Upload a valid UTF-8 CSV with a header and data rows.") from exc
    frame.columns = frame.columns.str.strip()
    if frame.empty or len(frame) > MAX_ROWS:
        raise DataError(f"CSV must contain between 1 and {MAX_ROWS} rows.")
    missing = sorted(set(FEATURES) - set(frame.columns))
    if missing:
        raise DataError("Missing required columns: " + ", ".join(missing))
    return frame


def numeric(frame):
    values = frame[FEATURES].apply(pd.to_numeric, errors="coerce")
    return values.replace([np.inf, -np.inf], np.nan)


def labels(frame):
    if "Label" not in frame:
        raise DataError("Training requires a Label column with BENIGN or NORMAL rows.")
    normalized = frame["Label"].astype("string").str.strip().str.upper()
    if normalized.isna().any() or normalized.eq("").any():
        raise DataError("Label values must be nonempty when a Label column is supplied.")
    return (~normalized.isin(["BENIGN", "NORMAL"])).astype(int).to_numpy()


@dataclass
class Detector:
    pipeline: object
    baseline: pd.DataFrame
    threshold: float
    metadata: dict

    @classmethod
    def train(cls, frame, contamination=0.05, source="uploaded"):
        y = labels(frame)
        benign = np.flatnonzero(y == 0)
        if len(benign) < 20:
            raise DataError("Provide at least 20 labeled benign flows for training and holdout evaluation.")
        train_idx, benign_test = train_test_split(benign, test_size=0.25, random_state=42)
        train = numeric(frame.iloc[train_idx])
        empty = train.columns[train.isna().all()].tolist()
        if empty:
            raise DataError("No valid benign training values for: " + ", ".join(empty))
        pipeline = make_pipeline(SimpleImputer(strategy="median"), IsolationForest(
            n_estimators=150, contamination=contamination, random_state=42, n_jobs=2))
        pipeline.fit(train)
        baseline = pd.DataFrame(pipeline[0].transform(train), columns=FEATURES)
        # score_samples is negative: negate so larger values mean more anomalous.
        threshold = float(-pipeline[-1].offset_)
        detector = cls(pipeline, baseline, threshold, {
            "algorithm": "Isolation Forest", "features": FEATURES,
            "training_rows": len(train_idx), "contamination": contamination,
            "source": source, "synthetic": source == "synthetic", "seed": 42,
            "threshold": threshold, "score_description": "Higher is more anomalous; not an attack probability.",
            "disclaimer": DISCLAIMER,
        })
        holdout = np.concatenate([benign_test, np.flatnonzero(y == 1)])
        detector.metadata["evaluation"] = detector.analyze(frame.iloc[holdout], limit=0)["evaluation"]
        detector.metadata["evaluation_rows"] = len(holdout)
        detector.metadata["evaluation_note"] = "Held-out benign rows and all supplied attack rows; preprocessing fitted only on benign training rows. Duplicate or related flows should be split by capture/time before upload for rigorous evaluation."
        return detector

    def analyze(self, frame, threshold=None, limit=100, offset=0):
        values = numeric(frame)
        missing = int(values.isna().sum().sum())
        if values.isna().all(axis=1).any():
            raise DataError("Each flow must have at least one valid numeric feature.")
        clean = self.pipeline[0].transform(values)
        scores = -self.pipeline[-1].score_samples(clean)
        cutoff = self.threshold if threshold is None else threshold
        predictions = scores > cutoff
        rows = []
        quantiles = self.baseline.quantile([0.05, 0.5, 0.95])
        for i in range(offset, min(len(frame), offset + limit)):
            evidence = []
            for j, name in enumerate(FEATURES):
                value = float(clean[i, j])
                low, median, high = quantiles[name].tolist()
                if value < low or value > high:
                    evidence.append({"feature": name, "value": value,
                                     "direction": "high" if value > high else "low",
                                     "benign_median": median, "benign_p05": low, "benign_p95": high,
                                     "imputed": bool(pd.isna(values.iloc[i, j]))})
            rows.append({"row": i + 1, "score": float(scores[i]),
                         "status": "Anomalous" if predictions[i] else "Normal",
                         "features": dict(zip(FEATURES, map(float, clean[i]))), "evidence": evidence})
        evaluation = None
        if "Label" in frame:
            truth = labels(frame)
            tn, fp, fn, tp = confusion_matrix(truth, predictions, labels=[0, 1]).ravel()
            precision, recall, f1, _ = precision_recall_fscore_support(
                truth, predictions, average="binary", zero_division=0)
            evaluation = {"confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
                          "precision": float(precision), "recall": float(recall), "f1": float(f1),
                          "false_positive_rate": float(fp / (tn + fp)) if tn + fp else None}
        counts, edges = np.histogram(scores, bins=10, range=(0, 1))
        return {"total_flows": len(frame), "anomalies": int(predictions.sum()),
                "normal": int((~predictions).sum()), "anomaly_percentage": float(predictions.mean() * 100),
                "threshold": float(cutoff), "imputed_values": missing,
                "score_distribution": [{"from": float(edges[i]), "to": float(edges[i+1]), "count": int(n)} for i, n in enumerate(counts)],
                "flows": rows, "offset": offset, "limit": limit, "evaluation": evaluation,
                "synthetic_model": self.metadata["synthetic"], "disclaimer": DISCLAIMER}


def demo_data():
    """Synthetic feature distributions for plumbing validation, never CIC-IDS2017."""
    rng = np.random.default_rng(42)
    n = 240
    data = pd.DataFrame({
        "Flow Duration": rng.lognormal(5, .5, n), "Total Fwd Packets": rng.poisson(30, n),
        "Total Backward Packets": rng.poisson(20, n), "Flow Bytes/s": rng.lognormal(8, .5, n),
        "Flow Packets/s": rng.lognormal(3, .3, n), "SYN Flag Count": rng.integers(0, 3, n),
        "Destination Port": rng.choice([53, 80, 443, 8080], n), "Label": ["BENIGN"] * 200 + ["SYNTHETIC_ATTACK"] * 40})
    data.loc[200:, FEATURES[:5]] *= 40
    return data
