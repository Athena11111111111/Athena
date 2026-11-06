"""Generate reproducible, explicitly synthetic CSVs without external dependencies."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import random

FEATURES = ["Flow Duration", "Total Fwd Packets", "Total Backward Packets",
            "Flow Bytes/s", "Flow Packets/s", "SYN Flag Count", "Destination Port"]
SOURCE = "Dataset Source"


def flows(seed, benign, anomalies=0):
    rng = random.Random(seed)
    rows = []
    for index in range(benign + anomalies):
        duration = rng.lognormvariate(math.log(150_000), 0.35)
        forward = max(1, round(rng.gauss(40, 6)))
        backward = max(1, round(rng.gauss(30, 5)))
        syn = rng.choices([0, 1, 2], [0.25, 0.65, 0.1])[0]
        port = rng.choice([53, 80, 443, 8080])
        label = "BENIGN"
        if index >= benign:
            variant = (index - benign) % 3
            if variant == 0:
                forward *= 80
                backward *= 40
                label = "SYNTHETIC_HIGH_VOLUME"
            elif variant == 1:
                duration *= 500
                label = "SYNTHETIC_LONG_DURATION"
            else:
                forward *= 30
                backward = 1
                syn = rng.randint(200, 500)
                label = "SYNTHETIC_SYN_BURST"
        packets = forward + backward
        packet_rate = packets / (duration / 1_000_000)
        byte_rate = packet_rate * rng.uniform(400, 900)
        rows.append(dict(zip(FEATURES, [round(duration, 6), forward, backward,
                                      round(byte_rate, 6), round(packet_rate, 6), syn, port])))
        rows[-1].update({"Label": label, SOURCE: "SYNTHETIC"})
    rng.shuffle(rows)
    return rows


def generate(output):
    output.mkdir(parents=True, exist_ok=True)
    records = []

    def save(name, rows, purpose, seed=None, expected_status=200, columns=None):
        columns = columns or FEATURES + ["Label", SOURCE]
        stream = io.StringIO(newline="")
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        content = stream.getvalue().encode("utf-8")
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        counts = {}
        if "Label" in columns:
            for row in rows:
                value = row.get("Label", "")
                counts[value] = counts.get(value, 0) + 1
        records.append({"file": name, "rows": len(rows), "seed": seed, "purpose": purpose,
                        "expected_http_status": expected_status, "label_counts": counts,
                        "sha256": hashlib.sha256(content).hexdigest()})

    training = flows(101, 1200)
    mixed = flows(202, 360, 90)
    normal = flows(303, 300)
    dirty = flows(404, 24, 6)
    save("synthetic_training_benign.csv", training, "Upload as Training CSV; contamination 0.05.", 101)
    save("synthetic_test_mixed_labeled.csv", mixed, "Analyze after training: 360 benign and 90 simulated anomalous flows.", 202)
    save("synthetic_test_benign_only.csv", normal, "Analyze to inspect false positives on separately generated benign flows.", 303)
    save("synthetic_test_unlabeled.csv", mixed, "Same features/order as mixed labeled test; analysis has no evaluation metrics.", 202,
         columns=FEATURES + [SOURCE])
    for index, value in enumerate(["", "", "inf", "-inf", "NaN", "NaN", "not_a_number", "inf"]):
        dirty[index][FEATURES[index % len(FEATURES)]] = value
    save("synthetic_test_dirty.csv", dirty, "Analyze: eight invalid values should be imputed; padded headers should be trimmed.", 404,
         columns=FEATURES + ["Label", SOURCE])
    # Keep values unchanged while adding the header whitespace seen in some CIC exports.
    dirty_path = output / "synthetic_test_dirty.csv"
    lines = dirty_path.read_text().splitlines(keepends=True)
    lines[0] = ",".join(f" {name} " for name in FEATURES + ["Label"]) + f",{SOURCE}\n"
    content = "".join(lines).encode()
    dirty_path.write_bytes(content)
    records[-1]["sha256"] = hashlib.sha256(content).hexdigest()

    invalid = flows(505, 25)
    save("invalid/missing_column.csv", invalid, "Analyze: reject missing Flow Bytes/s.", 505, 422,
         columns=[name for name in FEATURES + ["Label", SOURCE] if name != "Flow Bytes/s"])
    empty_row = [dict(row) for row in invalid]
    empty_row[0].update(dict.fromkeys(FEATURES, ""))
    save("invalid/all_invalid_row.csv", empty_row, "Analyze: reject a row with no valid numeric features.", 505, 422)
    empty_label = [dict(row) for row in invalid]
    empty_label[0]["Label"] = ""
    save("invalid/empty_label.csv", empty_label, "Train or analyze: reject an empty label.", 505, 422)
    save("invalid/too_few_benign.csv", invalid[:10], "Train: reject fewer than 20 benign flows.", 505, 422)
    save("invalid/duplicate_header.csv", invalid, "Train or analyze: reject duplicate headers.", 505, 422,
         columns=FEATURES + [FEATURES[0], "Label", SOURCE])
    manifest = {"synthetic": True, "generator": "scripts/generate_test_sets.py",
                "note": "Artificial demo distributions, not CIC-IDS2017, captured traffic, or proof of real-world accuracy.",
                "datasets": records}
    (output / "manifest.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "datasets/synthetic")
    args = parser.parse_args()
    manifest = generate(args.output)
    print(f"Generated {len(manifest['datasets'])} CSV files in {args.output}")
