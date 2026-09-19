"""Targeted interaction tests: the controls that were called out by name.

The brute-force audit says whether a control does *something*. These say whether
it does the *right* thing — paste a schema and the tool rows must actually fill in,
click a trace row and the steps must actually render.
"""
from __future__ import annotations

import json
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "https://agent-aegis.vercel.app"
SCHEMA = json.dumps([
    {"type": "function", "function": {
        "name": "get_invoice", "description": "Look up an invoice by id",
        "parameters": {"type": "object", "properties": {"invoice_id": {"type": "string"}},
                       "required": ["invoice_id"]}}},
    {"type": "function", "function": {
        "name": "refund_invoice", "description": "Refund an invoice"}},
    {"type": "function", "function": {
        "name": "delete_customer", "description": "Permanently delete a customer"}},
])

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
results: list[tuple[str, bool, str]] = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""), flush=True)


def test_schema_paste(page):
    page.goto(f"{BASE}/agents/new", wait_until="domcontentloaded", timeout=40000)
    page.wait_for_timeout(2500)

    paste = page.get_by_role("button", name="Paste schema")
    check("Paste schema button exists", paste.count() > 0)
    if not paste.count():
        return
    paste.first.click()
    page.wait_for_timeout(600)

    box = page.locator("textarea").last
    box.fill(SCHEMA)
    page.get_by_role("button", name="Import tools").first.click()
    page.wait_for_timeout(1200)

    names = page.locator("input[placeholder='check_order']")
    values = [names.nth(i).input_value() for i in range(names.count())]
    check("pasted schema populates the tool rows", set(values) >=
          {"get_invoice", "refund_invoice", "delete_customer"}, f"got {values}")

    body = page.inner_text("body")
    check("import is confirmed to the user", "Imported 3 tool" in body or "imported" in body.lower())


def test_upload_button(page):
    page.goto(f"{BASE}/agents/new", wait_until="domcontentloaded", timeout=40000)
    page.wait_for_timeout(2000)
    check("Upload .json control exists",
          page.get_by_role("button", name="Upload .json").count() > 0)

    path = r"D:\claude-scratch\tools_upload.json"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(SCHEMA)
    page.set_input_files("input[type=file]", path)
    page.wait_for_timeout(1500)
    names = page.locator("input[placeholder='check_order']")
    values = [names.nth(i).input_value() for i in range(names.count())]
    check("uploaded file populates the tool rows",
          "get_invoice" in values, f"got {values}")


def test_trace_view(page):
    page.goto(f"{BASE}/evaluations", wait_until="domcontentloaded", timeout=40000)
    page.wait_for_timeout(3000)
    link = page.locator("a[href*='/evaluations/']").first
    if not link.count():
        check("an evaluation exists to open", False)
        return
    link.click()
    page.wait_for_timeout(3500)
    check("evaluation report opens", "/evaluations/" in page.url, page.url.replace(BASE, ""))

    replay = page.get_by_role("button", name="Replay traces")
    check("Replay traces control exists", replay.count() > 0)

    # The scenario table should be clickable through to a per-test trace.
    rows = page.locator("table tbody tr")
    check("report lists scenarios", rows.count() > 0, f"{rows.count()} rows")
    if rows.count():
        before = page.url
        rows.first.click()
        page.wait_for_timeout(3000)
        moved = page.url != before
        body = page.inner_text("body")
        has_steps = any(word in body for word in ("tool-call", "Tool call", "Trace", "reasoning"))
        check("clicking a scenario opens its trace", moved or has_steps,
              f"url={page.url.replace(BASE, '')}")


def test_account_block(page):
    page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded", timeout=40000)
    page.wait_for_timeout(2500)
    body = page.inner_text("body")
    check("no fabricated user identity", "Jai Pratap" not in body and "jai@aegis.dev" not in body,
          "found the old placeholder persona" if "Jai Pratap" in body else "")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        for name, fn in [("SCHEMA PASTE", test_schema_paste), ("FILE UPLOAD", test_upload_button),
                         ("TRACE VIEW", test_trace_view), ("ACCOUNT", test_account_block)]:
            print(f"\n== {name} ==", flush=True)
            try:
                fn(page)
            except Exception as exc:
                check(f"{name} raised", False, str(exc)[:120])
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    for name, _, detail in failed:
        print(f"  FAILED: {name} {detail}")


if __name__ == "__main__":
    main()
