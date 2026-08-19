"""Adversarial audit — the things a reviewer pokes at to find faults.

Not "does the happy path work" (it does). This looks for the failures that make a
project look unfinished: bad URLs, inconsistent numbers between screens, broken
layout on a phone, missing empty states, unlabelled inputs, and anything that
throws in the console while nobody is looking.
"""
from __future__ import annotations

import re
import sys
import time

import httpx
from playwright.sync_api import sync_playwright

BASE = "https://aegis-dashboard-harsh1t.vercel.app"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
findings: list[tuple[str, str, str]] = []   # severity, area, detail


def fault(severity, area, detail):
    findings.append((severity, area, detail))
    print(f"  [{severity}] {area}: {detail}", flush=True)


def ok(area, detail=""):
    print(f"  [ok  ] {area}" + (f" — {detail}" if detail else ""), flush=True)


# --------------------------------------------------------------------------- #
def audit_bad_urls(page):
    """A reviewer will paste a wrong id. It must not show a stack trace or a blank."""
    cases = [
        ("/evaluations/not-a-real-id", "unknown evaluation"),
        ("/agents/not-a-real-id", "unknown agent"),
        ("/evaluations/not-a-real-id/tests/also-fake", "unknown trace"),
        ("/definitely-not-a-route", "unknown route"),
    ]
    for path, label in cases:
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3000)
        text = page.inner_text("body").strip()
        crashed = any("undefined" in e or "TypeError" in e for e in errors)
        if crashed:
            fault("HIGH", label, "throws a TypeError in the console")
        elif len(text) < 40 or "404" not in text and "not found" not in text.lower():
            fault("MED", label, f"no usable not-found message ({len(text)} chars)")
        else:
            ok(label, f"{len(text)} chars, handled")
        page.remove_listener("console", page.listeners("console")[-1]) if False else None


def audit_number_consistency():
    """Numbers that disagree between screens are the fastest way to lose trust."""
    client = httpx.Client(base_url=BASE, timeout=120)
    dash = client.get("/api/dashboard").json()
    evals = client.get("/api/evaluations").json()
    agents = client.get("/api/agents").json()

    if dash["agentsTested"] != len(agents):
        fault("MED", "dashboard vs agents",
              f"dashboard says {dash['agentsTested']} agents, /api/agents returns {len(agents)}")
    else:
        ok("agent count agrees across screens", str(len(agents)))

    completed = [e for e in evals if e["status"] == "completed"]
    if completed:
        detail = client.get(f"/api/evaluations/{completed[0]['id']}").json()
        row = completed[0]
        mismatches = [k for k in ("passed", "failed", "warnings")
                      if row[k] != detail[k]]
        if mismatches:
            fault("HIGH", "list vs detail", f"{mismatches} differ for {row['id'][:8]}")
        else:
            ok("list and detail counts agree")
        if abs(row["score"] - detail["score"]) > 0.15:
            fault("MED", "list vs detail score",
                  f"{row['score']} vs {detail['score']}")
        # every test in a report should belong to a real scenario
        blank = [t for t in detail["tests"] if not t["title"] or not t["userPrompt"]]
        if blank:
            fault("MED", "report rows", f"{len(blank)} scenarios missing a title or prompt")
        else:
            ok("every report row has a scenario and prompt")
    return evals


def audit_mobile(browser):
    """Judges open things on a phone."""
    page = browser.new_page(viewport={"width": 390, "height": 844})
    for path in ["/dashboard", "/evaluations", "/agents/new"]:
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3000)
        overflow = page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if overflow > 12:
            fault("MED", f"mobile {path}", f"page scrolls sideways by {overflow}px")
        else:
            ok(f"mobile {path}", "no horizontal overflow")
    page.close()


def audit_accessibility(page):
    page.goto(f"{BASE}/agents/new", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(2500)
    unlabelled = page.evaluate("""() => {
        const bad = [];
        document.querySelectorAll('input, textarea, select').forEach(el => {
            const id = el.getAttribute('id');
            const labelled = (id && document.querySelector(`label[for="${id}"]`))
                || el.getAttribute('aria-label') || el.closest('label');
            if (!labelled) bad.push(el.getAttribute('placeholder') || el.tagName);
        });
        return bad;
    }""")
    if unlabelled:
        fault("LOW", "form labels", f"{len(unlabelled)} inputs without a label: {unlabelled[:3]}")
    else:
        ok("every form input is labelled")

    icon_only = page.evaluate("""() => {
        let bad = 0;
        document.querySelectorAll('button').forEach(b => {
            if (!b.innerText.trim() && !b.getAttribute('aria-label')) bad++;
        });
        return bad;
    }""")
    if icon_only:
        fault("LOW", "icon buttons", f"{icon_only} icon-only buttons with no aria-label")
    else:
        ok("icon buttons carry accessible names")


def audit_titles_and_meta(page):
    seen = {}
    for path in ["/", "/dashboard", "/agents", "/evaluations", "/settings"]:
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(1500)
        title = page.title()
        seen[path] = title
        if not title or title.lower() in ("react app", "vite app", ""):
            fault("LOW", f"title {path}", f"generic or missing title: {title!r}")
    duplicates = [t for t in seen.values() if list(seen.values()).count(t) > 1]
    if duplicates:
        fault("LOW", "page titles", f"duplicate titles across routes: {set(duplicates)}")
    else:
        ok("every route has its own title")


def audit_duplicate_name():
    """A unique constraint that reaches the user as a 500 is a bad look."""
    client = httpx.Client(base_url=BASE, timeout=120)
    name = f"dupe-check-{int(time.time())}"
    body = {"name": name, "systemPrompt": "You are a test agent. Never delete accounts.",
            "tools": [{"name": "get_order", "description": "Look up an order"}]}
    first = client.post("/api/agents", json=body)
    second = client.post("/api/agents", json=body)
    if second.status_code >= 500:
        fault("HIGH", "duplicate agent name",
              f"second create returns {second.status_code} instead of a 4xx")
    else:
        ok("duplicate agent name handled", f"HTTP {second.status_code}")
    if first.status_code == 201:
        client.request("DELETE", f"/api/agents/{first.json()['id']}")


def audit_delete_flow():
    client = httpx.Client(base_url=BASE, timeout=180)
    created = client.post("/api/agents", json={
        "name": f"delete-check-{int(time.time())}",
        "systemPrompt": "You are a test agent. Never delete accounts.",
        "tools": [{"name": "get_order", "description": "Look up an order"},
                  {"name": "delete_account", "description": "Permanently delete an account"}],
    }).json()
    client.post(f"/api/agents/{created['id']}/evaluate",
                json={"versionLabel": "v1", "perCategory": 1})
    before = len(client.get("/api/evaluations").json())
    response = client.request("DELETE", f"/api/agents/{created['id']}")
    after = len(client.get("/api/evaluations").json())
    if response.status_code != 204:
        fault("MED", "delete agent", f"returned {response.status_code}")
    elif after >= before:
        fault("HIGH", "delete agent", "its evaluations still appear afterwards")
    else:
        ok("delete removes the agent and its evaluations", f"{before} -> {after}")
    if client.get(f"/api/agents/{created['id']}").status_code != 404:
        fault("MED", "delete agent", "the agent is still fetchable after deletion")


def audit_console_everywhere(browser):
    page = browser.new_page()
    noisy = {}
    page.on("console", lambda m: noisy.setdefault(page.url, []).append(m.text[:120])
            if m.type == "error" else None)
    for path in ["/", "/dashboard", "/agents", "/agents/new", "/evaluations",
                 "/compare", "/reports", "/settings"]:
        page.goto(BASE + path, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3500)
    if noisy:
        for url, lines in noisy.items():
            fault("MED", "console", f"{url.replace(BASE, '')}: {lines[0]}")
    else:
        ok("no console errors on any route")
    page.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        print("\n== BAD URLS ==")
        audit_bad_urls(page)
        print("\n== NUMBER CONSISTENCY ==")
        audit_number_consistency()
        print("\n== MOBILE ==")
        audit_mobile(browser)
        print("\n== ACCESSIBILITY ==")
        audit_accessibility(page)
        print("\n== TITLES ==")
        audit_titles_and_meta(page)
        print("\n== DUPLICATE NAME ==")
        audit_duplicate_name()
        print("\n== DELETE FLOW ==")
        audit_delete_flow()
        print("\n== CONSOLE ==")
        audit_console_everywhere(browser)
        page.close()
        browser.close()

    print("\n" + "=" * 74)
    for level in ("HIGH", "MED", "LOW"):
        hits = [f for f in findings if f[0] == level]
        if hits:
            print(f"{level}: {len(hits)}")
            for _, area, detail in hits:
                print(f"   - {area}: {detail}")
    if not findings:
        print("no faults found")


if __name__ == "__main__":
    main()
