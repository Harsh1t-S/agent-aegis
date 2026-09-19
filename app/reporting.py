"""Report assembly.

Shapes stored rows into exactly what the dashboard renders, so the frontend never
has to recompute a score or invent a taxonomy. One place owns the contract; if the
UI needs a new field it is added here, not derived in three components.
"""
from __future__ import annotations

from .classifier import TAXONOMY, distribution
from .scoring import aggregate, verdict


def run_summary(run, scenario, failures) -> dict:
    """One row of the scenario table on the report page."""
    severities = [f.severity for f in failures]
    worst = next((s for s in ("critical", "high", "medium", "low") if s in severities), None)
    return {
        "run_id": run.id,
        "scenario_id": scenario.id if scenario else None,
        "fingerprint": (scenario.fingerprint if scenario else "") or "",
        "scenario": scenario.name if scenario else "(deleted scenario)",
        "category": scenario.category if scenario else "unknown",
        "subtype": scenario.subtype if scenario else "unknown",
        "difficulty": scenario.difficulty if scenario else 0,
        "status": run.status,
        "outcome": run.outcome,
        "severity": worst,
        "score": run.reliability_score,
        "metrics": run.metrics or {},
        "duration_ms": run.duration_ms,
        "failure_types": sorted({f.failure_type for f in failures}),
    }


def failure_detail(failure) -> dict:
    evidence = failure.evidence or {}
    entry = TAXONOMY.get(failure.failure_type, {})
    return {
        "id": failure.id,
        "failure_type": failure.failure_type,
        "label": evidence.get("label", entry.get("label", failure.failure_type)),
        "group": evidence.get("group", entry.get("group", "other")),
        "severity": failure.severity,
        "steps": evidence.get("steps", []),
        "detail": evidence.get("detail", ""),
        "why": evidence.get("why", entry.get("why", "")),
        "recommendation": evidence.get("recommendation", entry.get("fix", "")),
        "detector_version": failure.detector_version,
        "evidence": evidence,
    }


def run_report(run, scenario, traces, failures) -> dict:
    """Everything the detail page needs for a single scenario run."""
    return {
        "summary": run_summary(run, scenario, failures),
        "scenario": {
            "id": scenario.id if scenario else None,
            "name": scenario.name if scenario else "",
            "category": scenario.category if scenario else "",
            "initial_prompt": scenario.initial_prompt if scenario else "",
            "expected_behavior": scenario.expected_behavior if scenario else {},
        },
        "failures": [failure_detail(f) for f in failures],
        "failure_distribution": distribution(
            [{"failure_type": f.failure_type} for f in failures]),
        "trace": [
            {
                "step": t.step_number,
                "type": t.step_type,
                "payload": t.payload,
                "latency_ms": t.latency_ms,
                "flagged": t.step_number in {
                    step for f in failures for step in (f.evidence or {}).get("steps", [])},
            }
            for t in traces
        ],
    }


def version_report(version, agent, rows: list[dict], failures_by_run: dict[str, list]) -> dict:
    """The dashboard's per-version rollup."""
    totals = aggregate(rows)
    every_failure = [{"failure_type": f.failure_type}
                     for group in failures_by_run.values() for f in group]
    critical = sum(1 for group in failures_by_run.values()
                   for f in group if f.severity == "critical")
    return {
        "agent": {"id": agent.id if agent else None,
                  "name": agent.name if agent else "",
                  "domain": (agent.profile or {}).get("domain") if agent else None},
        "version": {"id": version.id, "label": version.version_label},
        "score": totals["score"],
        "verdict": totals["verdict"],
        "passed": totals["passed"],
        "failed": totals["failed"],
        "warnings": totals["warnings"],
        "total": totals["total"],
        "critical_failures": critical,
        "metrics": totals["metrics"],
        "failure_distribution": distribution(every_failure),
        "scenarios": rows,
    }


def compare_report(older, newer, old_rows: list[dict], new_rows: list[dict]) -> dict:
    """Scenario-level diff. Aggregate deltas hide flips that cancel out."""
    # Match on the scenario's stable fingerprint, not its row id. Every evaluation
    # writes fresh scenario rows, so keying on scenario_id meant two versions of the
    # same agent shared nothing and every comparison reported zero regressions.
    def key(row):
        return row.get("fingerprint") or row["scenario_id"]

    old_by = {key(r): r for r in old_rows if key(r)}
    new_by = {key(r): r for r in new_rows if key(r)}
    shared = old_by.keys() & new_by.keys()

    # Outcomes are ranked so a pass -> warning is reported as a softening rather
    # than a regression. Collapsing both into "regressed" made a version whose
    # score went *up* look like it had broken things.
    rank = {"pass": 2, "warning": 1, "fail": 0}
    regressions, improvements, softened = [], [], []
    for scenario_id in shared:
        before, after = old_by[scenario_id], new_by[scenario_id]
        was, now = rank.get(before["outcome"], 0), rank.get(after["outcome"], 0)
        entry = {"scenario_id": scenario_id, "scenario": after["scenario"],
                 "from": before["outcome"], "to": after["outcome"],
                 "failure_types": after["failure_types"]}
        if now < was:
            (regressions if after["outcome"] == "fail" else softened).append(entry)
        elif now > was:
            improvements.append(entry)

    # Score movement is only meaningful on the exact paired contract. Coverage
    # changes are reported separately instead of being smuggled into the delta.
    paired_old = [old_by[item] for item in shared]
    paired_new = [new_by[item] for item in shared]
    old_totals = aggregate(paired_old)
    new_totals = aggregate(paired_new)
    old_suite = aggregate(old_rows)
    new_suite = aggregate(new_rows)
    added = sorted(new_by.keys() - old_by.keys())
    removed = sorted(old_by.keys() - new_by.keys())
    return {
        "older": {"id": older.id, "label": older.version_label,
                  "score": old_totals["score"], "suite_score": old_suite["score"]},
        "newer": {"id": newer.id, "label": newer.version_label,
                  "score": new_totals["score"], "suite_score": new_suite["score"]},
        "score_delta": (round(new_totals["score"] - old_totals["score"], 1)
                        if shared else None),
        "verdict": verdict(new_totals["score"]) if shared else "Not comparable",
        "shared_scenarios": len(shared),
        "comparable": bool(shared),
        "coverage_changed": bool(added or removed),
        "added_scenarios": [{"scenario_id": item,
                             "scenario": new_by[item]["scenario"]} for item in added],
        "removed_scenarios": [{"scenario_id": item,
                               "scenario": old_by[item]["scenario"]} for item in removed],
        "regressions": regressions,       # became an outright failure
        "softened": softened,             # still not failing, but picked up findings
        "improvements": improvements,
        "metric_deltas": {
            name: round(new_totals["metrics"].get(name, 0) - old_totals["metrics"].get(name, 0), 4)
            for name in new_totals["metrics"]
        },
    }
