# Athena backend

Python 3.12 API for the Next.js dashboard. No external APIs, dataset download, credentials, or database are required. The frontend calls this API through the Next.js `/api/*` proxy; see the root README for running both services and browser tests.

From the repository root:

```sh
python -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
.venv/bin/python -m pytest backend/tests -q
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Interactive API documentation is served at `/docs`. The development CORS defaults allow localhost:3000 and 127.0.0.1:3000; set `ATHENA_CORS_ORIGINS` to a comma-separated origin list to override.

## Quick demonstration

```sh
curl -X POST http://127.0.0.1:8000/api/demo
curl http://127.0.0.1:8000/api/model
```

The demo trains on 150 synthetic benign flows and analyzes a disjoint holdout of 50 benign and 40 synthetic attack flows. All demo responses explicitly identify the synthetic model. It is a plumbing demonstration, not evidence of real-world accuracy or CIC-IDS2017 performance.

## Upload workflow

1. `GET /api/features` lists the required numerical feature names. Headers have surrounding whitespace removed, accommodating CIC-IDS2017 CSV exports.
2. `POST /api/train?contamination=0.05` with multipart field `file` trains a model. `Label` is required: `BENIGN` and `NORMAL` (case insensitive) mean benign; all other nonempty labels mean attack. At least 20 benign rows are required. Contamination must be greater than 0 and at most 0.5.
3. `POST /api/analyze` with a CSV in multipart field `file` uses that model. Labels are optional. Query parameters: `threshold` (0–1), `offset` (default 0), `limit` (default 100, maximum 1000). Lower thresholds flag more flows. Summaries and metrics cover the entire upload, while only the flow list is paginated. Row numbers are one-based data row positions in the uploaded CSV.

```sh
curl -F file=@training.csv 'http://127.0.0.1:8000/api/train?contamination=0.05'
curl -F file=@testing.csv 'http://127.0.0.1:8000/api/analyze?limit=100&offset=0'
```

Required features: `Flow Duration`, `Total Fwd Packets`, `Total Backward Packets`, `Flow Bytes/s`, `Flow Packets/s`, `SYN Flag Count`, `Destination Port`. Labels and other columns never become model features. Limits: 10 MiB CSV content and 50,000 rows. Non-numeric, missing, and infinite values are replaced with medians fitted only on benign training data. Completely invalid analysis rows and training columns without valid benign values are rejected. Responses report the number of imputed values.

Training deterministically reserves 25% of benign rows for holdout and trains on the remaining benign rows only. All supplied attack rows are evaluation-only. Evaluation contains the confusion matrix, precision, recall, F1, and false-positive rate (null when there are no benign evaluation rows). For rigorous real-world evaluation, provide independently collected testing data via `/api/analyze`; deduplicate flows and separate captures/time periods before upload. Random row splitting cannot prevent related-flow leakage on its own.

Scores are negated Isolation Forest `score_samples`: higher means more anomalous, not an attack probability. A flow is anomalous when its score is strictly greater than the threshold. The default threshold comes from the fitted contamination. Feature evidence compares values against the benign training 5th/50th/95th percentiles; this is descriptive supporting evidence, not a causal explanation of Isolation Forest predictions. An anomaly is not proof of an attack.

## State and deployment limits

One model is shared in memory per process. A successful training or demo request replaces it; failed training preserves it. Training requests are serialized and analysis can continue against the prior model. Restarting loses the model; use a single Uvicorn worker. There is deliberately no pickle/model upload endpoint.

This is a local hackathon service without authentication, durable storage, or multi-user isolation. Bind to loopback for development. Before public deployment, add authentication, per-user model ownership, rate limits, and reverse-proxy body limits (the CSV size check occurs after multipart parsing). Real CIC-IDS2017 data is not bundled or downloaded.
