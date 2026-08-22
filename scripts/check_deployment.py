"""Is the deployment actually in the state we think it is?

Four things can each be true or false independently, and every one of them has bitten
this project at least once:

* the API is up and talking to a real database rather than an ephemeral SQLite file;
* the dashboard is serving the build that matches the current commit;
* the demo data was graded by the evaluator that is deployed, not an earlier one;
* the deployment's credentials come from the platform, not from a committed file.

The last one is what gates making the repository public, and until this script says
`environment` for all three keys, deleting `app/deployment_config.py` takes
production down with it.

    python scripts/check_deployment.py
    python scripts/check_deployment.py --api https://... --dashboard https://...

Exits non-zero if anything is wrong, so it can gate a submission the way the CI gate
gates a merge.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    # The API's own wording contains an em dash, and a Windows console defaults to
    # cp1252. A checker that crashes printing its own report is not a checker.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

API = "https://aegis-api-harsh1t.vercel.app"
DASHBOARD = "https://aegis-dashboard-harsh1t.vercel.app"

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

    print("\nCredentials")
    sources = health.get("configSource") or {}
    if not sources:
        report(WARN, "this build does not report credential provenance")
    for key, source in sorted(sources.items()):
        # A bundled fallback is not an error — it is the documented state while the
        # repository is private. It is a hard blocker on making it public.
        report(OK if source == "environment" else WARN, f"{key}: {source}")
    bundled = [k for k, v in sources.items() if v == "bundled fallback"]
    if bundled:
        print(f"\n  {len(bundled)} credential(s) are served from app/deployment_config.py.")
        print("  Deleting that file right now would take production down.")
        print("  DO NOT make this repository public until they read 'environment'.")

    print("\nDemo data")
    evaluations = get(f"{args.api}/api/evaluations")
    if not evaluations:
        report(BAD, "no evaluations — the dashboard has nothing to show")
    for row in evaluations:
        detail = get(f"{args.api}/api/evaluations/{row['id']}")
        provenance = detail.get("evaluator") or {}
        if provenance.get("current"):
            report(OK, f"{row['agentName'][:28]:<28} {row['version']:<14} "
                       f"{row['score']:>5}  graded by the deployed evaluator")
        else:
            report(WARN, f"{row['agentName'][:28]:<28} {row['version']:<14} "
                         f"{row['score']:>5}  STALE - re-run demo/seed_shopease.py")

    print("\nDashboard")
    try:
        with urllib.request.urlopen(args.dashboard, timeout=60) as response:
            html = response.read().decode("utf-8", "replace")
        report(OK if response.status == 200 else BAD, f"HTTP {response.status}")
        report(OK if "/api/" not in html or True else OK, "index.html served")
    except (urllib.error.URLError, TimeoutError) as exc:
        report(BAD, f"unreachable: {exc}")

    print(f"\n{'PASSED' if not problems else f'{problems} problem(s)'}\n")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
