# Synthetic Athena test sets

These are artificial demonstration files, **not real network captures or CIC-IDS2017**. The `Dataset Source` column identifies every row as `SYNTHETIC` and is ignored by the model. Simulated anomaly labels describe how values were generated, not proven attacks. High scores on these deliberately distinct distributions do not establish real-world accuracy.

## Quick start

1. In the dashboard, select `synthetic_training_benign.csv` as **Training CSV**, leave contamination at `0.05`, and click **Train model**. The backend trains on 900 benign rows and reserves 300 for internal holdout.
2. Select `synthetic_test_mixed_labeled.csv` as **Analysis CSV** and click **Analyze CSV**. It contains 450 flows: 360 benign and 90 simulated anomalies. Metrics cover the entire file, while the table shows 100 rows per page.
3. Inspect flagged rows and their feature comparisons. Apply thresholds `1` and `0` to see zero and 450 flagged flows respectively; reset the threshold afterward.
4. Try the other files below. Analyze them against the same trained baseline; do not retrain on evaluation files or click the separate built-in demo between these steps.

The model metadata calls a CSV-trained model an “Uploaded baseline.” The backend's `synthetic_model` flag only identifies its built-in demo; it does **not** detect the provenance of uploaded CSVs. All files here remain synthetic regardless of that flag.

## Valid files

| File | Rows | Use and expected behavior |
| --- | ---: | --- |
| `synthetic_training_benign.csv` | 1,200 | Train; all labels are BENIGN. |
| `synthetic_test_mixed_labeled.csv` | 450 | Analyze; 360 benign and 30 examples each of high volume, long duration, and SYN bursts. Shows evaluation metrics. |
| `synthetic_test_benign_only.csv` | 300 | Analyze; all benign. Any flagged rows are false positives relative to the synthetic labels. Recall/F1 are zero because there are no positive labels. |
| `synthetic_test_unlabeled.csv` | 450 | Analyze; exact same feature values/order as the mixed labeled file, without Label. Scores should match; evaluation metrics are unavailable. Cannot be used for training. |
| `synthetic_test_dirty.csv` | 30 | Analyze; 24 benign and 6 anomalous. Includes padded headers and eight blank/non-numeric/infinite values. Should succeed and report eight imputed values. |

Training, benign-only evaluation, mixed evaluation, and dirty evaluation use independent seeds. There are no duplicate feature rows across those sets. The labeled/unlabeled mixed pair deliberately shares features for checking label independence. All files are well below the upload limits. Durations are synthetic microseconds; rates are derived per second. The seven feature names match the backend's expected schema.

## Expected validation failures

Train a valid model first before trying analysis failures. These are intentionally invalid:

| File in `invalid/` | Action | Expected error (HTTP 422) |
| --- | --- | --- |
| `missing_column.csv` | Analyze | Missing required column Flow Bytes/s. |
| `all_invalid_row.csv` | Analyze | Each flow must have at least one valid numeric feature. |
| `empty_label.csv` | Train or analyze | Label values must be nonempty. |
| `too_few_benign.csv` | Train | At least 20 benign flows are required. |
| `duplicate_header.csv` | Train or analyze | Column names must be unique. |

Failed requests should leave the prior model and successful analysis intact. Exact anomaly counts at the fitted default threshold depend on the model and library version; the 90 synthetic positive labels are ground truth for this fixture, not a promise of exactly 90 predictions.

## Reproduce and verify

From the repository root:

```sh
python scripts/generate_test_sets.py
.venv/bin/python -m pytest backend/tests/test_sample_datasets.py -q
```

The generator uses only Python's standard library and fixed seeds. It refreshes the ten named CSV files and `manifest.json`, which records row counts, labels, intended actions, and SHA-256 checksums. It does not change this README. To generate into a different directory, pass `--output /path/to/directory`.
