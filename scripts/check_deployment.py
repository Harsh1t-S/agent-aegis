"""Is the deployment actually in the state we think it is?

Four things can each be true or false independently, and every one of them has
broken at least once here:

* the API is up and talking to a real database, not an ephemeral SQLite file;
* its credentials are configured, so writes survive between invocations;
* the demo data was graded by the evaluator that is deployed, not an older one;
* the dashboard is reachable.

    python scripts/check_deployment.py
    python scripts/check_deployment.py --api https://... --dashboard https://...

Exits non-zero if anything is wrong, so it can gate a release the way the CI gate
gates a merge.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    # The API's own wording contains an em dash and a Windows console defaults to
    # cp1252. A checker that crashes printing its own report is not a checker.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

API = "https://agent-aegis-api.vercel.app"
DASHBOARD = "https://agent-aegis.vercel.app"

OK, WARN, BAD = "ok  ", "warn", "FAIL"


def get(url: str):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=API)
    parser.add_argument("--dashboard", default=DASHBOARD)
    args = parser.parse_args(argv)

    problems = 0

    def report(state: str, line: str) -> None:
        nonlocal problems
        if state == BAD:
            problems += 1
        print(f"  [{state}] {line}")

    print("\nAPI")
    try:
        health = get(f"{args.api}/health")
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"  [{BAD}] unreachable: {exc}")
        return 1

    report(OK if health["status"] == "ok" else BAD,
           f"status {health['status']}, database {health['database']}")
    evaluator = health["evaluator"]
    print(f"  [{OK}] evaluator {evaluator['generator']} / {evaluator['guardrail']} / "
          f"{evaluator['detector']} / {evaluator['profile']} / {evaluator['scorer']}")
    print(f"         @ {evaluator['commit'][:12]}")

    print("\nConfiguration")
    sources = health.get("configSource") or {}
    if not sources:
        report(WARN, "this build does not report which credentials it found")
    for key, source in sorted(sources.items()):
        report(OK if source == "environment" else BAD, f"{key}: {source}")

    print("\nDemo data")
    evaluations = get(f"{args.api}/api/evaluations")
    if not evaluations:
        report(BAD, "no evaluations - the dashboard has nothing to show")
    for row in evaluations:
        detail = get(f"{args.api}/api/evaluations/{row['id']}")
        provenance = detail.get("evaluator") or {}
        if provenance.get("current"):
            report(OK, f"{row['agentName'][:28]:<28} {row['version']:<14} "
                       f"{row['score']:>5}  graded by the deployed evaluator")
        else:
            report(WARN, f"{row['agentName'][:28]:<28} {row['version']:<14} "
                         f"{row['score']:>5}  stale - re-run demo/seed_shopease.py")

    print("\nDashboard")
    try:
        with urllib.request.urlopen(args.dashboard, timeout=60) as response:
            response.read()
        report(OK if response.status == 200 else BAD, f"HTTP {response.status}")
    except (urllib.error.URLError, TimeoutError) as exc:
        report(BAD, f"unreachable: {exc}")

    print(f"\n{'PASSED' if not problems else f'{problems} problem(s)'}\n")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
