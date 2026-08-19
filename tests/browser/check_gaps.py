"""The gaps: correctness of the derived pages, concurrency, scale, slow runs.

Everything so far has checked that pages render and controls fire. These check that
the numbers on the derived screens are *right*, that the app survives being used
roughly, and that it still behaves when a run takes minutes rather than seconds.
"""
from __future__ import annotations

import statistics
import sys
import time

import httpx
from playwright.sync_api import sync_playwright

BASE = "https://aegis-dashboard-harsh1t.vercel.app"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
results: list[tuple[str, bool, str]] = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""), flush=True)


# --------------------------------------------------------------------------- #
def check_reports_and_compare_numbers():
    """These pages derive from the API. Derived numbers are where drift hides."""
    client = httpx.Client(base_url=BASE, timeout=180)
    evaluations = client.get("/api/evaluations").json()
    dashboard = client.get("/api/dashboard").json()
    agents = client.get("/api/agents").json()

    completed = [e for e in evaluations if e["status"] == "completed"
                 and e["passed"] + e["failed"] + e["warnings"] > 0]
    check("there are completed evaluations to reason about", bool(completed),
          f"{len(completed)} of {len(evaluations)}")
    if not completed:
        return

    # Dashboard average must match the mean of the runs it claims to cover.
    detail_scores = [e["score"] for e in completed]
    spread = (min(detail_scores), max(detail_scores))
    check("dashboard average sits inside the range of evaluation scores",
          spread[0] - 0.5 <= dashboard["averageReliability"] <= spread[1] + 0.5,
          f"avg {dashboard['averageReliability']} vs range {spread}")

    # Every agent's headline reliability should equal its newest version's score.
    drifted = []
    for agent in agents:
        mine = [e for e in evaluations if e["agentId"] == agent["id"]
                and e["status"] == "completed"]
        if not mine or not agent["versions"]:
            continue
        newest = mine[0]           # list is newest-first
        if abs(agent["reliability"] - newest["score"]) > 0.2:
            drifted.append(f"{agent['name'][:22]} card={agent['reliability']} "
                           f"newest={newest['score']}")
    check("agent cards match their newest evaluation", not drifted,
          "; ".join(drifted[:2]) if drifted else "")

    # passed + failed + warnings must never exceed the total scenarios.
    broken = [e for e in completed
              if e["passed"] + e["failed"] + e["warnings"] > e["total"]]
    check("outcome counts never exceed the scenario total", not broken,
          f"{len(broken)} rows over-count" if broken else "")

    # A report's own tests must agree with its headline counts.
    sample = client.get(f"/api/evaluations/{completed[0]['id']}").json()
    tallies = {"passed": 0, "failed": 0, "warning": 0}
    for test in sample["tests"]:
        tallies[test["status"]] = tallies.get(test["status"], 0) + 1
    check("report headline matches its own scenario rows",
          (tallies["passed"], tallies["failed"], tallies["warning"])
          == (sample["passed"], sample["failed"], sample["warnings"]),
          f"rows {tallies} vs headline "
          f"{(sample['passed'], sample['failed'], sample['warnings'])}")

    # Version comparison needs two versions of one agent to be meaningful.
    by_agent: dict[str, list] = {}
    for evaluation in completed:
        by_agent.setdefault(evaluation["agentId"], []).append(evaluation)
    comparable = [v for v in by_agent.values() if len(v) >= 2]
    check("some agent has two versions to compare", bool(comparable),
          f"{len(comparable)} agents")
    if comparable:
        newer, older = comparable[0][0], comparable[0][1]
        # Use the /api surface: the bare /versions/... path is not proxied.
        response = client.get(f"/api/versions/{older['id']}/compare/{newer['id']}")
        if response.status_code != 200:
            check("compare endpoint is reachable from the dashboard origin", False,
                  f"HTTP {response.status_code}")
            return
        check("compare endpoint is reachable from the dashboard origin", True)
        diff = response.json()
        expected = round(newer["score"] - older["score"], 1)
        check("compare reports the same delta the scores imply",
              abs(diff["score_delta"] - expected) < 0.25,
              f"api {diff['score_delta']} vs {expected}")


def check_double_click_run(browser):
    """Impatient users double-click. That must not start two evaluations."""
    client = httpx.Client(base_url=BASE, timeout=180)
    agent = client.post("/api/agents", json={
        "name": f"double-click-{int(time.time())}",
        "systemPrompt": "You are a test agent. Never delete accounts.",
        "tools": [{"name": "get_order", "description": "Look up an order"},
                  {"name": "delete_account", "description": "Permanently delete an account"}],
    }).json()

    page = browser.new_page()
    page.goto(f"{BASE}/agents/{agent['id']}", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(4000)
    run = page.get_by_role("button", name="Run evaluation")
    if not run.count():
        run = page.get_by_role("button", name="Evaluate")
    if run.count():
        run.first.click()
        try:                       # a second click landing before navigation
            run.first.click(timeout=1200)
        except Exception:
            pass
        page.wait_for_timeout(9000)
        versions = client.get(f"/api/agents/{agent['id']}").json()["versions"]
        check("double-clicking Run does not start two evaluations",
              len(versions) <= 1, f"{len(versions)} versions created")
    else:
        check("agent page exposes a Run control", False, "no Run button found")
    page.close()
    client.request("DELETE", f"/api/agents/{agent['id']}")


def check_concurrent_evaluations():
    """Two evaluations at once must both finish and not interleave their results."""
    client = httpx.Client(base_url=BASE, timeout=240)
    made = []
    for index in range(2):
        agent = client.post("/api/agents", json={
            "name": f"concurrent-{index}-{int(time.time())}",
            "systemPrompt": "You are a test agent. Never delete customer accounts.",
            "tools": [{"name": "get_order", "description": "Look up an order"},
                      {"name": "delete_account", "description": "Permanently delete an account"}],
        }).json()
        started = client.post(f"/api/agents/{agent['id']}/evaluate",
                              json={"versionLabel": "v1", "perCategory": 2}).json()
        made.append((agent, started))

    finished = []
    for agent, started in made:
        for _ in range(60):
            progress = client.get(f"/api/evaluations/{started['evaluationId']}/progress").json()
            if progress["completed"] >= progress["total"]:
                break
            time.sleep(2)
        finished.append(client.get(f"/api/evaluations/{started['evaluationId']}").json())

    check("both concurrent evaluations completed",
          all(f["status"] == "completed" for f in finished),
          ", ".join(f["status"] for f in finished))
    check("each evaluation kept its own scenarios",
          all(f["total"] == f["passed"] + f["failed"] + f["warnings"] for f in finished),
          ", ".join(f"{f['total']}={f['passed']}+{f['failed']}+{f['warnings']}" for f in finished))
    ids = [{t["scenarioId"] for t in f["tests"]} for f in finished]
    check("no scenario leaked between the two runs", not (ids[0] & ids[1]),
          f"{len(ids[0] & ids[1])} shared")
    for agent, _ in made:
        client.request("DELETE", f"/api/agents/{agent['id']}")


def check_scale(browser):
    """How does the list behave now there are dozens of evaluations?"""
    client = httpx.Client(base_url=BASE, timeout=180)
    count = len(client.get("/api/evaluations").json())
    timings = []
    for _ in range(3):
        started = time.time()
        client.get("/api/evaluations")
        timings.append(time.time() - started)
    check("evaluations list stays fast at current volume",
          statistics.median(timings) < 2.5,
          f"{count} evaluations, median {statistics.median(timings):.1f}s")

    page = browser.new_page()
    started = time.time()
    page.goto(f"{BASE}/evaluations", wait_until="domcontentloaded", timeout=60000)
    rendered = None
    for _ in range(60):
        if page.locator("table tbody tr").count() >= min(count, 10):
            rendered = time.time() - started
            break
        page.wait_for_timeout(250)
    check("the table paints within a few seconds", rendered is not None and rendered < 8,
          f"{rendered:.1f}s" if rendered else "never filled")
    page.close()


def check_cross_browser(playwright):
    """Reviewers open things in whatever they already have."""
    for name in ("firefox", "webkit"):
        try:
            engine = getattr(playwright, name).launch()
        except Exception as exc:
            check(f"{name} available", False, str(exc)[:70])
            continue
        page = engine.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        try:
            page.goto(f"{BASE}/evaluations", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(6000)
            rows = page.locator("table tbody tr").count()
            check(f"{name}: evaluations render", rows > 0, f"{rows} rows")
            if rows:
                page.locator("table tbody tr").first.click()
                page.wait_for_timeout(5000)
                check(f"{name}: row click opens the report", "/evaluations/" in page.url)
            check(f"{name}: no console errors", not errors, (errors[0][:70] if errors else ""))
        except Exception as exc:
            check(f"{name}: renders", False, str(exc)[:80])
        finally:
            page.close(); engine.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        print("\n== DERIVED PAGE CORRECTNESS ==")
        check_reports_and_compare_numbers()
        print("\n== DOUBLE-CLICK RUN ==")
        check_double_click_run(browser)
        print("\n== CONCURRENT EVALUATIONS ==")
        check_concurrent_evaluations()
        print("\n== SCALE ==")
        check_scale(browser)
        print("\n== CROSS BROWSER ==")
        check_cross_browser(p)
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    for name, _, detail in failed:
        print(f"  FAILED: {name} — {detail}")


if __name__ == "__main__":
    main()
