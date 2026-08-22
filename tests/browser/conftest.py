"""Keep pytest out of this directory.

These are standalone scripts that drive a deployed site with Playwright, not unit
tests: they need a browser and a live URL, and collecting them made the backend
suite report errors for fixtures that do not exist here.
"""
collect_ignore_glob = ["*.py"]
