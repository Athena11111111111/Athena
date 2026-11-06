import numpy as np
from fastapi.testclient import TestClient
from backend.main import app
from backend.model import Detector, FEATURES, demo_data, read_csv


def upload(frame):
    return {"file": ("flows.csv", frame.to_csv(index=False).encode(), "text/csv")}


def test_demo_and_sensitivity():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["model_ready"] is False
        assert client.get("/api/model").status_code == 409
        result = client.post("/api/demo").json()
        assert result["model"]["synthetic"] is True
        assert result["model"]["training_rows"] == 150
        analysis = result["analysis"]
        assert analysis["total_flows"] == 90
        assert analysis["evaluation"]["recall"] > .9
        assert analysis["anomalies"] >= 40
        data = demo_data().drop(columns="Label")
        low = client.post("/api/analyze?threshold=0", files=upload(data)).json()
        high = client.post("/api/analyze?threshold=1", files=upload(data)).json()
        assert low["anomalies"] == 240
        assert high["anomalies"] == 0
        assert low["evaluation"] is None


def test_upload_validation_cleaning_and_pagination():
    with TestClient(app) as client:
        frame = demo_data()
        response = client.post("/api/train", files=upload(frame))
        assert response.status_code == 200
        assert response.json()["synthetic"] is False
        frame.loc[0, "Flow Bytes/s"] = np.inf
        frame.loc[1, "Flow Duration"] = np.nan
        result = client.post("/api/analyze?offset=200&limit=3", files=upload(frame)).json()
        assert len(result["flows"]) == 3
        assert result["flows"][0]["row"] == 201
        assert result["flows"][0]["evidence"]
        assert result["imputed_values"] == 2
        bad = client.post("/api/train", files=upload(frame.drop(columns="Label")))
        assert bad.status_code == 422
        assert client.get("/api/model").status_code == 200  # Failed training preserves model.
        assert client.post("/api/analyze", files=upload(frame.drop(columns=FEATURES[0]))).status_code == 422
        assert client.post("/api/train?contamination=0", files=upload(frame)).status_code == 422
        frame.loc[0, FEATURES] = np.nan
        assert client.post("/api/analyze", files=upload(frame)).status_code == 422


def test_labels_and_attacks_never_enter_training():
    frame = demo_data()
    detector = Detector.train(frame)
    changed = frame.copy()
    changed.loc[200:, FEATURES] = 1e12
    second = Detector.train(changed)
    np.testing.assert_array_equal(detector.pipeline[0].statistics_, second.pipeline[0].statistics_)
    np.testing.assert_array_equal(detector.pipeline[-1].score_samples(detector.baseline.to_numpy()),
                                  second.pipeline[-1].score_samples(second.baseline.to_numpy()))
    raw = frame.to_csv(index=False).replace("Flow Duration", " Flow Duration ")
    assert read_csv(raw.encode()).columns[0] == "Flow Duration"


def test_invalid_csv_and_labels():
    with TestClient(app) as client:
        for content in [b"", b"\xff", b"a,a\n1,2", b"a\n1"]:
            assert client.post("/api/train", files={"file": ("bad.csv", content)}).status_code == 422
        data = demo_data()
        data.loc[0, "Label"] = ""
        assert client.post("/api/train", files=upload(data)).status_code == 422
        data["Label"] = "ATTACK"
        assert client.post("/api/train", files=upload(data)).status_code == 422


def test_upload_limits_and_cors():
    with TestClient(app) as client:
        assert client.post("/api/train", files={"file": ("large.csv", b"x" * (10 * 1024 * 1024 + 1))}).status_code == 413
        from backend.model import MAX_ROWS
        import pandas as pd
        frame = pd.concat([demo_data().iloc[:1]] * (MAX_ROWS + 1), ignore_index=True)
        assert client.post("/api/train", files=upload(frame)).status_code == 422
        response = client.options("/api/analyze", headers={
            "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
