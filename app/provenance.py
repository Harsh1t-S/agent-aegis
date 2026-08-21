"""Which logic graded a result.

A judge opening a verdict has to be able to ask "what code produced this?" and get
an answer. Before this module, "guardrail version" was doing two jobs at once: it
named the semantics of the guardrail compiler *and* it was the database marker that
told reliability scoring which rows to exclude. That coupling meant bumping the
compiler silently changed which runs counted, so the safe move was never to bump
it — and the stored data drifted away from the code that claimed to have produced
it.

They are separated here. `run_kind` says what a row *is* (a scored suite scenario
or a diagnostic guardrail probe) and never changes when semantics do. The version
strings say what produced it and are free to move. Every completed run records the
whole set, so a stored result can be traced to the exact evaluator that graded it —
and a result graded by an older evaluator can be *labelled* as such instead of
silently presented as current.
"""
from __future__ import annotations

import os
import subprocess
from functools import lru_cache

from .detectors import DETECTOR_VERSION
from .guardrail import GUARDRAIL_VERSION
from .introspect import PROFILE_VERSION
from .scenarios import GENERATOR_VERSION
from .scoring import SCORER_VERSION

# What a TestRun's scenario is for. Deliberately not a version string: reliability
# scoring excludes diagnostics by kind, so bumping guardrail semantics can never
# again change which rows are scored.
RUN_KIND_SUITE = "suite"
RUN_KIND_GUARDRAIL = "guardrail"

# Rows written before run_kind existed. Kept only so those rows keep being excluded
# from scoring; nothing new is ever written with these.
LEGACY_GUARDRAIL_GENERATORS = ("guardrail-v1", "guardrail-v2")


@lru_cache(maxsize=1)
def evaluator_commit() -> str:
    """The commit this evaluator is running from, if it can be established.

    Vercel injects the SHA; a local checkout has git. Neither is guaranteed, so an
    unknown commit is reported as unknown rather than guessed at — a wrong commit
    is worse than no commit when the point is reproducibility.
    """
    for key in ("AEGIS_COMMIT", "VERCEL_GIT_COMMIT_SHA", "GITHUB_SHA"):
        value = os.getenv(key)
        if value:
            return value[:40]
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                             text=True, timeout=2, cwd=os.path.dirname(__file__))
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()[:40]
    except Exception:  # noqa: BLE001 - provenance must never break a request
        pass
    return "unknown"


def evaluator_stamp(scenario_generator: str | None = None) -> dict:
    """The full provenance set, stamped onto every completed run.

    `scenario_generator` overrides the generator field with the version that
    actually wrote the scenario being graded. Without that override a run replayed
    through today's detectors would claim today's generator too, which is the
    precise misreport this module exists to prevent: the oracle is as old as the
    scenario, however new the detector is.
    """
    return {
        "generator": scenario_generator or GENERATOR_VERSION,
        "guardrail": GUARDRAIL_VERSION,
        "detector": DETECTOR_VERSION,
        "profile": PROFILE_VERSION,
        # The scorer turns findings into a verdict, so a change here changes the
        # answer as surely as a detector change does. Leaving it out meant the most
        # recent semantic change Aegis made — crediting a refusal the tool evidence
        # supports, which flipped a stored failure to a pass — moved no version at
        # all, and evaluations graded under the old rule kept reporting themselves
        # as current.
        "scorer": SCORER_VERSION,
        "commit": evaluator_commit(),
    }


#: The semantic versions only — the part that decides whether a stored result was
#: graded by today's logic. The commit is excluded on purpose: a commit that only
#: touched the frontend does not make an evaluation stale.
SEMANTIC_KEYS = ("generator", "guardrail", "detector", "profile", "scorer")


def is_current(stamp: dict | None) -> bool:
    """Was this result produced by the evaluator semantics running right now?

    A run with no stamp predates provenance entirely, which is exactly the case the
    judge caught: results on screen produced by older semantics than the deployed
    code. Unstamped counts as not current.
    """
    if not stamp:
        return False
    current = evaluator_stamp()
    return all(stamp.get(key) == current[key] for key in SEMANTIC_KEYS)


def staleness(stamp: dict | None) -> dict:
    """Describe how a stored result relates to the current evaluator."""
    current = evaluator_stamp()
    if not stamp:
        return {"current": False, "reason": "graded before evaluator provenance was recorded",
                "recorded": None, "expected": current}
    drifted = [key for key in SEMANTIC_KEYS if stamp.get(key) != current[key]]
    if not drifted:
        return {"current": True, "reason": "", "recorded": stamp, "expected": current}
    detail = ", ".join(f"{key} {stamp.get(key) or '—'} → {current[key]}" for key in drifted)
    return {"current": False, "reason": f"graded by an earlier evaluator ({detail})",
            "recorded": stamp, "expected": current}
