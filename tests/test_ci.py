from types import SimpleNamespace

from app.ci import evaluate_gates

REPORT = {
    "score": 86.0, "passed": 9, "warnings": 1, "failed": 1,
    "metrics": {"safety": 100.0, "groundedness": 72.0},
    "failureBreakdown": [{"category": "Unsafe Action", "count": 0, "severity": "low"},
                         {"category": "Hallucination", "count": 2, "severity": "high"}],
}


def opts(**kwargs):
    base = dict(min_score=80.0, max_critical=0, max_failed=2,
                min_metric=None, min_resistance=None)
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_all_gates_pass_on_a_good_run():
    gates = evaluate_gates(REPORT, None, opts())
    assert all(ok for ok, _ in gates)


def test_score_floor_fails_the_build():
    gates = evaluate_gates(REPORT, None, opts(min_score=95.0))
    assert not all(ok for ok, _ in gates)


def test_a_critical_failure_fails_the_build():
    report = {**REPORT, "failureBreakdown": [
        {"category": "Unsafe Action", "count": 1, "severity": "critical"}]}
    gates = evaluate_gates(report, None, opts())
    assert not all(ok for ok, _ in gates)


def test_every_gate_is_reported_not_short_circuited():
    """One run should show all failing gates, not just the first."""
    gates = evaluate_gates(REPORT, None, opts(min_score=99.0, max_failed=0))
    assert sum(1 for ok, _ in gates if not ok) >= 2


def test_metric_floor_is_checked():
    gates = evaluate_gates(REPORT, None, opts(min_metric=["groundedness=90"]))
    assert not all(ok for ok, _ in gates)
    gates = evaluate_gates(REPORT, None, opts(min_metric=["safety=90"]))
    assert all(ok for ok, _ in gates)


def test_guardrail_resistance_gate():
    gates = evaluate_gates(REPORT, {"resistanceScore": 40.0}, opts(min_resistance=60.0))
    assert not all(ok for ok, _ in gates)
    gates = evaluate_gates(REPORT, {"resistanceScore": 80.0}, opts(min_resistance=60.0))
    assert all(ok for ok, _ in gates)


def test_the_gate_can_put_a_real_model_under_test():
    """Without an adapter the CI gate graded the scripted fake, whose behaviour is
    fixed traits rather than the agent's prompt — so hardening the prompt could not
    move the score and the gate was not measuring the agent at all."""
    import inspect

    from app.ci import main, run_evaluation

    signature = inspect.signature(run_evaluation)
    assert "adapter" in signature.parameters and "models" in signature.parameters

    source = inspect.getsource(main)
    assert "--adapter" in source and "--model" in source
