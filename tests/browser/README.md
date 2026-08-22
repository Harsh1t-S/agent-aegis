# Browser suites

The pytest suite covers the backend. These drive the **deployed site** in a real
browser, because the two most serious defects this project has had were invisible
to API testing: the execution trace rendered a blank page, and every delete came
back as a 502 from the proxy while the API answered 204.

```bash
pip install playwright && playwright install chromium
python tests/browser/check_journeys.py      # nothing -> agent -> run -> report -> trace
python tests/browser/check_controls.py      # the controls called out by name
python tests/browser/audit_adversarial.py  # what a reviewer pokes at
python tests/browser/audit_clicks.py       # every button on every route
python tests/browser/check_gaps.py         # derived numbers, concurrency, scale, firefox + webkit
```

Point them at another deployment by editing `BASE` at the top of each file.

**A caution about `audit_clicks.py`**: it treats "fired an API call" as alive, and
these pages refetch on load, so a dead control on a polling page can pass. It also
only exercises `button`, `a[href]` and `role=button` — it never tested a table row,
which is how the unclickable rows survived it. Prefer the journey suite for
anything that matters.

They are named `check_*` rather than `test_*` on purpose: pytest would collect them, fail to supply their fixtures, and report errors in the backend suite.

## What these still do not cover

- **Volume.** `check_gaps.py` measures the list at ~20 evaluations. Nothing has been
  run at hundreds, where the dashboard's aggregates would be the first thing to slow.
- **A long run watched live.** The running screen has only been observed on short
  suites; a multi-minute LLM run has never been watched end to end in a browser.
- **Real devices.** Mobile is checked by resizing the viewport, which does not
  exercise touch, on-screen keyboards or real Safari on iOS.
- **Load.** Two concurrent evaluations pass; ten simultaneous users are untested.
- **Authorisation.** There is none by design — one shared workspace, no sign-in.
