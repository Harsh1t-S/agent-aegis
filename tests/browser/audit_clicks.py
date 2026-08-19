"""Click-audit of the deployed dashboard.

Visits every route, enumerates every visible control, and clicks each one from a
fresh page load, recording what actually happened: navigation, an API call, a
visible DOM change, or nothing at all. Also captures console errors and failed
network requests per route.

A control that produces none of the four is dead, whatever its label says.
"""
from __future__ import annotations

import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "https://aegis-dashboard-harsh1t.vercel.app"
ROUTES = ["/", "/dashboard", "/agents", "/agents/new", "/evaluations",
          "/compare", "/reports", "/settings"]
DESTRUCTIVE = re.compile(r"delete|remove|destroy", re.I)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def audit_route(browser, route, dynamic_routes):
    page = browser.new_page()
    console, failed = [], []
    page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
    page.on("requestfailed", lambda r: failed.append(f"{r.method} {r.url.split('?')[0]}"))

    url = BASE + route
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception as exc:
        page.close()
        return {"route": route, "error": str(exc)[:120], "controls": [],
                "console": console, "failed": failed}
    page.wait_for_timeout(2500)

    # Harvest any real ids this page exposes, so detail routes can be audited too.
    for href in page.eval_on_selector_all("a[href]", "els => els.map(e => e.getAttribute('href'))"):
        if href and re.match(r"^/(evaluations|agents)/[0-9a-f-]{8,}", href):
            dynamic_routes.add(href)

    handles = page.query_selector_all("button, a[href], [role='button']")
    controls = []
    for index in range(len(handles)):
        fresh = browser.new_page()
        calls, errors = [], []
        fresh.on("request", lambda r: calls.append(r.url) if "/api/" in r.url else None)
        fresh.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        try:
            fresh.goto(url, wait_until="domcontentloaded", timeout=25000)
            fresh.wait_for_timeout(1800)
            nodes = fresh.query_selector_all("button, a[href], [role='button']")
            if index >= len(nodes):
                fresh.close(); continue
            node = nodes[index]
            label = ((node.inner_text() or "").strip().replace("\n", " ")[:44]
                     or node.get_attribute("aria-label") or "(icon)")
            if not node.is_visible():
                fresh.close(); continue
            disabled = node.is_disabled()
            if DESTRUCTIVE.search(label):
                controls.append({"label": label, "verdict": "SKIPPED (destructive)",
                                 "disabled": disabled})
                fresh.close(); continue

            before_url = fresh.url
            before_html = len(fresh.content())
            node.click(timeout=8000)
            fresh.wait_for_timeout(1500)
            after_url = fresh.url
            after_html = len(fresh.content())

            if after_url != before_url:
                verdict = f"navigates -> {after_url.replace(BASE, '')}"
            elif calls:
                verdict = f"calls api ({len(calls)})"
            elif abs(after_html - before_html) > 400:
                verdict = "changes the page"
            else:
                verdict = "DEAD"
            controls.append({"label": label, "verdict": verdict, "disabled": disabled,
                             "console": errors[:2]})
        except Exception as exc:
            controls.append({"label": f"(index {index})", "verdict": f"ERROR {str(exc)[:70]}"})
        finally:
            fresh.close()

    page.close()
    return {"route": route, "controls": controls, "console": console[:5],
            "failed": failed[:5]}


def main():
    dynamic: set[str] = set()
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for route in ROUTES:
            print(f"auditing {route} ...", flush=True)
            results.append(audit_route(browser, route, dynamic))
        for route in sorted(dynamic)[:3]:
            print(f"auditing {route} ...", flush=True)
            results.append(audit_route(browser, route, set()))
        browser.close()

    print("\n" + "=" * 78)
    dead = 0
    for entry in results:
        print(f"\n### {entry['route']}")
        if entry.get("error"):
            print(f"   PAGE ERROR: {entry['error']}")
        for control in entry["controls"]:
            mark = "DEAD" if control["verdict"] == "DEAD" else "ok  "
            if control["verdict"] == "DEAD":
                dead += 1
            flag = " [disabled]" if control.get("disabled") else ""
            print(f"   {mark} {control['label']:<44}{flag} {control['verdict']}")
        for line in entry.get("console", []):
            print(f"   console-error: {line[:110]}")
        for line in entry.get("failed", []):
            print(f"   request-failed: {line[:110]}")
    print("\n" + "=" * 78)
    print(f"DEAD CONTROLS: {dead}")
    with open(r"D:\claude-scratch\ui_audit.json", "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)


if __name__ == "__main__":
    main()
