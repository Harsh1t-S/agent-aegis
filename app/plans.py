"""Server-owned subscription entitlements."""
from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Plan:
    key: str
    name: str
    monthly_scenario_credits: int
    concurrency: int
    retention_days: int
    members: int
    workspaces: int
    ci_gate: bool
    monthly_model_spend_cap_usd: float
    private_projects: bool = True

    def payload(self) -> dict:
        return asdict(self)


PLANS = {
    "trial": Plan("trial", "Pilot trial", 25, 1, 14, 1, 1, False, 2.0),
    "starter": Plan("starter", "Starter", 500, 2, 90, 3, 1, True, 50.0),
    "team": Plan("team", "Team", 5000, 5, 365, 20, 5, True, 500.0),
    # Local development and automated tests should not need a fake payment.
    "development": Plan(
        "development", "Development", 1_000_000, 16, 3650, 100, 100,
        True, 1_000_000.0,
    ),
}


def plan_for(key: str | None) -> Plan:
    return PLANS.get(key or "", PLANS["trial"])
