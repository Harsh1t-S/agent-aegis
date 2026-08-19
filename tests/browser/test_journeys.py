"""End-to-end journeys, not individual controls.

The click-audit answers "does this button do something". These answer "can a person
actually get from nothing to a finished evaluation, and does the product behave when
they do the wrong thing". Everything runs against the deployed site.
"""
from __future__ import annotations

import json
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "https://aegis-dashboard-harsh1t.vercel.app"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""), flush=True)


def new_page(browser):
    page = browser.new_page()
    page.on("console", lambda m: console_errors.append(f"{m.text[:130]}")
            if m.type == "error" else None)
    return page


# --------------------------------------------------------------------------- #
def journey_create_agent(browser):
    """Nothing -> agent -> running evaluation -> report -> trace, all by clicking."""
    page = new_page(browser)
    page.goto(f"{BASE}/agents/new", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(2500)

    name = f"journey-{int(time.time())}"
    page.fill("input[placeholder='Customer Support Agent']", name)

    # Domain is a shadcn Select, not a native <select>.
    page.get_by_role("combobox").first.click()
    page.wait_for_timeout(500)
    page.get_by_role("option").first.click()
    page.wait_for_timeout(400)

    # Two textareas exist: description first, system prompt second. Filling by
    # tag name silently filled the description and left the prompt empty, so the
    # form correctly refused and the test blamed the product.
    boxes = page.locator("textarea")
    boxes.nth(0).fill("Handles refunds and order lookups.")
    boxes.nth(1).fill("You are a support agent. Never delete customer accounts. "
                      "Always verify the order ID before changing an order.")

    page.get_by_role("button", name="Paste schema").first.click()
    page.wait_for_timeout(500)
    page.locator("textarea").last.fill(json.dumps([
        {"name": "get_order", "description": "Look up an order"},
        {"name": "update_order", "description": "Update an order"},
        {"name": "delete_account", "description": "Permanently delete an account"},
    ]))
    page.get_by_role("button", name="Import tools").first.click()
    page.wait_for_timeout(1200)

    page.get_by_role("button", name="Create Agent").first.click()
    page.wait_for_timeout(9000)
    check("Create Agent starts a run and leaves the form",
          "/evaluations/" in page.url, page.url.replace(BASE, "")[:60])
    if "/evaluations/" not in page.url:
        page.close()
        return None

    evaluation_id = page.url.split("/evaluations/")[1].split("/")[0]

    # The running screen should report real progress, not a fake animation.
    body = page.inner_text("body")
    check("running screen shows scenario progress",
          any(k in body for k in ("scenarios executed", "of ", "Scenario")), "")

    # Wait for the run to finish, then open the report.
    for _ in range(50):
        page.goto(f"{BASE}/evaluations/{evaluation_id}", wait_until="domcontentloaded",
                  timeout=45000)
        page.wait_for_timeout(3000)
        if page.locator("table tbody tr").count():
            break
    rows = page.locator("table tbody tr").count()
    check("report fills with scenarios", rows > 0, f"{rows} rows")

    if rows:
        page.locator("table tbody tr").first.click()
        page.wait_for_timeout(4000)
        text = page.inner_text("body")
        check("scenario row opens a readable trace",
              "/tests/" in page.url and len(text) > 400,
              f"{len(text)} chars at {page.url.replace(BASE, '')[:40]}")
    page.close()
    return evaluation_id


def journey_bad_input(browser):
    """A product is judged by what it does when you feed it rubbish."""
    page = new_page(browser)
    page.goto(f"{BASE}/agents/new", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(2500)

    page.get_by_role("button", name="Create Agent").first.click()
    page.wait_for_timeout(1500)
    check("empty form is rejected with a message",
          "required" in page.inner_text("body").lower() and "/agents/new" in page.url)

    page.get_by_role("button", name="Paste schema").first.click()
    page.wait_for_timeout(400)
    page.locator("textarea").last.fill("{ this is not json ")
    page.get_by_role("button", name="Import tools").first.click()
    page.wait_for_timeout(1200)
    body = page.inner_text("body")
    check("malformed JSON is reported, not swallowed",
          "json" in body.lower() or "not valid" in body.lower())

    page.locator("textarea").last.fill('[{"description":"no name here"}]')
    page.get_by_role("button", name="Import tools").first.click()
    page.wait_for_timeout(1200)
    check("schema with no usable tools is reported",
          "no tools" in page.inner_text("body").lower()
          or "no name" in page.inner_text("body").lower())
    page.close()


def journey_search(browser):
    page = new_page(browser)
    page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(3000)
    page.keyboard.press("Control+k")
    page.wait_for_timeout(1200)
    opened = page.locator("[role=dialog], [cmdk-root]").count() > 0
    check("Ctrl-K opens the search palette", opened)
    if opened:
        page.keyboard.type("agent")
        page.wait_for_timeout(1200)
        hits = page.locator("[cmdk-item], [role=option]").count()
        check("search returns results", hits > 0, f"{hits} items")
        page.keyboard.press("Escape")
    page.close()


def journey_settings(browser):
    page = new_page(browser)
    page.goto(f"{BASE}/settings", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(2500)
    toggles = page.locator("[role=switch]")
    before = [toggles.nth(i).get_attribute("aria-checked") for i in range(toggles.count())]
    check("settings exposes toggles", toggles.count() > 0, f"{toggles.count()}")
    if toggles.count():
        toggles.first.click()
        page.wait_for_timeout(400)
        expected = [toggles.nth(i).get_attribute("aria-checked") for i in range(toggles.count())]
        page.get_by_role("button", name="Save changes").first.click()
        page.wait_for_timeout(1500)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(3500)
        again = page.locator("[role=switch]")
        actual = [again.nth(i).get_attribute("aria-checked") for i in range(again.count())]
        check("a saved setting survives a reload", actual == expected,
              f"{before} -> {actual}")
    page.close()


def journey_agent_detail(browser):
    page = new_page(browser)
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(3500)
    cards = page.locator("a[href^='/agents/']")
    check("agents page lists agents", cards.count() > 0, f"{cards.count()} links")
    if cards.count():
        page.goto(BASE + cards.first.get_attribute("href"), wait_until="domcontentloaded",
                  timeout=45000)
        page.wait_for_timeout(4000)
        text = page.inner_text("body")
        check("agent detail renders", len(text) > 500, f"{len(text)} chars")
        check("agent detail shows its tools",
              any(k in text for k in ("Tools", "tool", "risk")), "")
    page.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for title, fn in [("CREATE AGENT JOURNEY", journey_create_agent),
                          ("BAD INPUT", journey_bad_input),
                          ("SEARCH", journey_search),
                          ("SETTINGS", journey_settings),
                          ("AGENT DETAIL", journey_agent_detail)]:
            print(f"\n== {title} ==", flush=True)
            try:
                fn(browser)
            except Exception as exc:
                check(f"{title} raised", False, str(exc)[:130])
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    for name, _, detail in failed:
        print(f"  FAILED: {name} {detail}")
    if console_errors:
        print(f"\nconsole errors seen ({len(console_errors)}):")
        for line in dict.fromkeys(console_errors):
            print("   ", line)


if __name__ == "__main__":
    main()
