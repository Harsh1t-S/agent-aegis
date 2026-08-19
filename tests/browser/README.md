# Browser suites

The pytest suite covers the backend. These drive the **deployed site** in a real
browser, because the two most serious defects this project has had were invisible
to API testing: the execution trace rendered a blank page, and every delete came
back as a 502 from the proxy while the API answered 204.

```bash
pip install playwright && playwright install chromium
python tests/browser/test_journeys.py      # nothing -> agent -> run -> report -> trace
python tests/browser/test_controls.py      # the controls called out by name
python tests/browser/audit_adversarial.py  # what a reviewer pokes at
python tests/browser/audit_clicks.py       # every button on every route
```

Point them at another deployment by editing `BASE` at the top of each file.

**A caution about `audit_clicks.py`**: it treats "fired an API call" as alive, and
these pages refetch on load, so a dead control on a polling page can pass. It also
only exercises `button`, `a[href]` and `role=button` — it never tested a table row,
which is how the unclickable rows survived it. Prefer the journey suite for
anything that matters.
