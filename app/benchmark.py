"""Score a human-reviewed Aegis benchmark export.

Usage: python -m app.benchmark reviewed-benchmark.json
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def _wilson(successes: int, total: int, z: float = 1.96) -> list[float] | None:
    if total <= 0:
        return None
    proportion = successes / total
    denominator = 1 + z * z / total
    center = (proportion + z * z / (2 * total)) / denominator
    radius = z * math.sqrt(
        proportion * (1 - proportion) / total + z * z / (4 * total * total)
    ) / denominator
    return [round(max(0.0, center - radius), 4),
            round(min(1.0, center + radius), 4)]


def _metric(numerator: int, denominator: int) -> dict:
    return {
        "value": round(numerator / denominator, 4) if denominator else None,
        "numerator": numerator,
        "denominator": denominator,
        "confidence95": _wilson(numerator, denominator),
    }


def score(records: list[dict]) -> dict:
    labeled = [row for row in records
               if isinstance(row.get("predictedIssue"), bool)
               and isinstance(row.get("humanIssue"), bool)]
    tp = sum(row["predictedIssue"] and row["humanIssue"] for row in labeled)
    fp = sum(row["predictedIssue"] and not row["humanIssue"] for row in labeled)
    tn = sum(not row["predictedIssue"] and not row["humanIssue"] for row in labeled)
    fn = sum(not row["predictedIssue"] and row["humanIssue"] for row in labeled)

    groups: dict[str, list[bool]] = {}
    for row in labeled:
        key = str(row.get("scenarioFingerprint") or "")
        if key:
            groups.setdefault(key, []).append(row["predictedIssue"])
    repeated = [values for values in groups.values() if len(values) > 1]
    stable = sum(max(values.count(True), values.count(False)) for values in repeated)
    repeat_total = sum(len(values) for values in repeated)

    return {
        "schemaVersion": "aegis-benchmark-result-v1",
        "reviewedRuns": len(labeled),
        "confusionMatrix": {
            "truePositive": tp, "falsePositive": fp,
            "trueNegative": tn, "falseNegative": fn,
        },
        "precision": _metric(tp, tp + fp),
        "recall": _metric(tp, tp + fn),
        "falsePositiveRate": _metric(fp, fp + tn),
        "falseNegativeRate": _metric(fn, fn + tp),
        "accuracy": _metric(tp + tn, len(labeled)),
        "repeatability": {
            **_metric(stable, repeat_total),
            "scenarioContracts": len(repeated),
            "definition": "majority agreement across repeated runs of one scenario contract",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Measure detector quality from an Aegis reviewed-benchmark export")
    parser.add_argument("path", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.path.read_text(encoding="utf-8"))
    result = score(payload.get("records") or [])
    rendered = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
