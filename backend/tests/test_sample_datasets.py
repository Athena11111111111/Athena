"""Check shipped fixtures and their actual upload behavior."""
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import FEATURES

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "datasets/synthetic"


def test_fixtures_reproduce_and_keep_evaluation_separate(tmp_path):
    subprocess.run([sys.executable, str(ROOT / "scripts/generate_test_sets.py"), "--output", str(tmp_path)], check=True)
    manifest = json.loads((DATA / "manifest.json").read_text())
    for name in [entry["file"] for entry in manifest["datasets"]] + ["manifest.json"]:
        assert (DATA / name).read_bytes() == (tmp_path / name).read_bytes()
    seen = set()
    for name in ["synthetic_training_benign.csv", "synthetic_test_mixed_labeled.csv", "synthetic_test_benign_only.csv", "synthetic_test_dirty.csv"]:
        frame = pd.read_csv(DATA / name)
        frame.columns = frame.columns.str.strip()
        rows = set(frame[FEATURES].astype(str).itertuples(index=False, name=None))
        assert len(rows) == len(frame)
        assert not seen.intersection(rows)
        seen.update(rows)
        assert frame["Dataset Source"].eq("SYNTHETIC").all()


def test_shipped_csvs_work_through_api():
    def upload(name):
        return {"file": (name, (DATA / name).read_bytes(), "text/csv")}

    with TestClient(app) as client:
        trained = client.post("/api/train", files=upload("synthetic_training_benign.csv"))
        assert trained.status_code == 200
        assert trained.json()["training_rows"] == 900
        mixed = client.post("/api/analyze?limit=1000", files=upload("synthetic_test_mixed_labeled.csv"))
        assert mixed.status_code == 200
        result = mixed.json()
        assert result["total_flows"] == 450
        matrix = result["evaluation"]["confusion_matrix"]
        assert matrix["tp"] + matrix["fn"] == 90
        assert matrix["tn"] + matrix["fp"] == 360
        assert 0 < result["anomalies"] < 450
        unlabeled = client.post("/api/analyze?limit=1000", files=upload("synthetic_test_unlabeled.csv")).json()
        assert unlabeled["evaluation"] is None
        np.testing.assert_array_equal([flow["score"] for flow in result["flows"]],
                                      [flow["score"] for flow in unlabeled["flows"]])
        clean = client.post("/api/analyze", files=upload("synthetic_test_benign_only.csv")).json()
        assert clean["total_flows"] == 300
        assert clean["evaluation"]["confusion_matrix"]["tp"] == 0
        dirty = client.post("/api/analyze", files=upload("synthetic_test_dirty.csv"))
        assert dirty.status_code == 200
        assert dirty.json()["imputed_values"] == 8
        for name, action, message in [
            ("missing_column.csv", "analyze", "Missing required columns"),
            ("all_invalid_row.csv", "analyze", "at least one valid numeric"),
            ("empty_label.csv", "analyze", "nonempty"),
            ("too_few_benign.csv", "train", "at least 20"),
            ("duplicate_header.csv", "train", "unique"),
        ]:
            response = client.post(f"/api/{action}", files=upload(f"invalid/{name}"))
            assert response.status_code == 422
            assert message in response.json()["detail"]
        assert client.get("/api/model").json() == trained.json()
