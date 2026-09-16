import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { MetricLine } from '@/components/MetricLine';
import { FailureReveal } from '@/components/FailureReveal';
import { TestResult } from '@/components/TestResult';
import { CiGatePanel } from '@/components/CiGatePanel';
import { ProvenancePanel } from '@/components/ProvenancePanel';
import { useToast } from '@/components/Toaster';
import { GuardrailLadder } from '@/components/GuardrailLadder';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { METRIC_COLORS } from '@/lib/palette';
import { api, ApiError } from '@/lib/api';
import { deltaTone, evaluationPath, formatDate, isEvaluationActive, signed, verdictFrom } from '@/lib/format';
import type { TestStatus } from '@/types';
import { ArrowRight } from 'lucide-react';

type Filter = 'all' | TestStatus;

export default function EvaluationResults() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: evaluation, error, loading, reload } = useResource(
    () => api.evaluation(id as string),
    [id],
    { enabled: Boolean(id) },
  );
  const scoring = useResource(() => api.scoring(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [ladderRunning, setLadderRunning] = useState(false);
  const [ladderStarting, setLadderStarting] = useState(false);

  const reportReady = Boolean(evaluation) && !isEvaluationActive(evaluation?.status);
  const ciGate = useResource(() => api.ciGate(id as string), [id], { enabled: Boolean(id) && reportReady });
  // Polls only while probes are in flight; the ladder is queued server-side and
  // rungs land one at a time.
  const guardrail = useResource(
    () => api.guardrail(id as string),
    [id],
    { enabled: Boolean(id) && reportReady, pollMs: ladderRunning ? 2000 : undefined },
  );

  // Stop polling when the ladder reports every expected rung, not on a timer.
  // A fixed 30s window quietly abandoned a slow ladder mid-run and left the
  // report showing a partial result as though it were the final one.
  const ladderComplete =
    ladderRunning &&
    (guardrail.data?.pending === 0 || (
      Boolean(guardrail.data?.rungsExpected) &&
      (guardrail.data?.rungsRun ?? 0) >= (guardrail.data?.rungsExpected ?? 0)));
  useEffect(() => {
    if (ladderComplete) setLadderRunning(false);
  }, [ladderComplete]);
  useEffect(() => {
    if (guardrail.data?.canContinue === false) setLadderRunning(false);
    else if ((guardrail.data?.pending ?? 0) > 0) setLadderRunning(true);
  }, [guardrail.data?.pending, guardrail.data?.canContinue]);

  const runLadder = async () => {
    if (!id) return;
    setLadderStarting(true);
    try {
      const queued = await api.startGuardrail(id);
      guardrail.reload();
      toast.success(
        `Queued ${queued.queued} pressure probe${queued.queued === 1 ? '' : 's'}`,
        'Rungs appear as each one completes.',
      );
    } catch (err) {
      // An agent with no irreversible tool has nothing to pressure-test, and the
      // API says so with a 400. Swallowing it left the button spinning against a
      // rejected promise and told the user nothing.
      setLadderRunning(false);
      toast.error(
        'Ladder not started',
        err instanceof ApiError ? err.message : 'The guardrail probes were not queued.',
      );
    } finally {
      setLadderStarting(false);
    }
  };

  // A ladder that never reports is still a stuck spinner; give up after five
  // minutes and say so rather than spinning forever.
  useEffect(() => {
    if (!ladderRunning) return;
    const timer = setTimeout(() => {
      setLadderRunning(false);
      toast.info('Still waiting on the ladder', 'Reload the report to pick up any later rungs.');
    }, 300_000);
    return () => clearTimeout(timer);
  }, [ladderRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <LoadingState label="LOADING REPORT" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <div className="px-6 py-16 md:px-10">
          <ErrorState message={error ?? 'Evaluation not found.'} onRetry={reload} />
          <div className="mt-6 text-center">
            <Link
              to="/app/agents"
              className="border border-signal-500/40 px-6 py-3 font-mono text-xs uppercase tracking-wider text-signal-400 hover:bg-signal-500/10"
            >
              BACK TO AGENTS
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isEvaluationActive(evaluation.status)) return <Navigate to={evaluationPath(evaluation)} replace />;

  const counts: Record<Filter, number> = {
    all: evaluation.tests.length,
    passed: evaluation.tests.filter((t) => t.status === 'passed').length,
    failed: evaluation.tests.filter((t) => t.status === 'failed').length,
    warning: evaluation.tests.filter((t) => t.status === 'warning').length,
  };
  const filteredTests = evaluation.tests.filter((t) => filter === 'all' || t.status === filter);
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'passed', label: 'PASSED' },
    { key: 'failed', label: 'FAILED' },
    { key: 'warning', label: 'WARNING' },
  ];

  const delta = evaluation.score - evaluation.previousScore;
  // criticalCount is what the gate acts on; the plain count includes findings
  // that only cap the score at 80. Reporting one as the other made the dashboard
  // and the CI gate disagree.
  const criticalFindings = evaluation.failureBreakdown.reduce(
    (sum, item) => sum + (item.criticalCount ?? 0),
    0,
  );
  // Which ceiling actually bound this run. The gates are ordered strictest
  // first, and only the unsafe-action one caps at 30 — treating any critical
  // finding as that gate would misreport a capped-at-60 run as capped at 30.
  const criticalUnsafe = evaluation.failureBreakdown.some(
    (item) => item.category === 'Unsafe Action' && (item.criticalCount ?? 0) > 0,
  );
  const highFindings = evaluation.failureBreakdown.some(
    (item) => item.count > 0 && item.severity === 'high',
  );
  const gates = scoring.data?.gates ?? [];
  const gateApplied = criticalUnsafe
    ? gates[0]
    : criticalFindings > 0
      ? gates[1]
      : highFindings
        ? gates[2]
        : undefined;

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-bone-500">
          <Link
            to={`/app/agents/${evaluation.agentId}`}
            className="inline-flex min-h-9 items-center hover:text-bone-200"
          >
            {evaluation.agentName.toUpperCase()}
          </Link>
          <span>/</span>
          <span className="text-signal-400">{evaluation.version}</span>
          <span>/</span>
          <span>{formatDate(evaluation.date)}</span>
        </div>

        {(evaluation.errors ?? 0) > 0 && (
          <div role="alert" className="mt-6 border border-fault-500/40 bg-fault-500/10 p-4 text-sm text-bone-200">
            {evaluation.errors} scenario execution{evaluation.errors === 1 ? '' : 's'} failed.
            {' '}The score covers completed scenarios only. Review the error traces and rerun them; this evaluation cannot pass CI.
          </div>
        )}
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <SystemLabel>RELIABILITY REPORT</SystemLabel>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex items-baseline gap-2">
                <span className="massive text-5xl text-bone-50 sm:text-6xl md:text-7xl">
                  {evaluation.tests.length === evaluation.errors ? '—' : evaluation.score.toFixed(1)}
                </span>
                <span className="font-mono text-lg text-bone-500 sm:text-xl">/100</span>
              </div>
              <div className="border-l border-bone-600/30 pl-4 sm:pl-6">
                <SystemLabel className="text-bone-600">PREVIOUS</SystemLabel>
                <div className="mt-1 font-mono text-lg text-bone-300">
                  {evaluation.previousScore.toFixed(1)}
                </div>
                <div className={`mt-1 font-mono text-xs ${deltaTone(delta)}`}>{signed(delta)}</div>
              </div>
              <div className="border-l border-bone-600/30 pl-6">
                <SystemLabel className="text-bone-600">VERDICT</SystemLabel>
                <div className="mt-1 font-mono text-sm text-bone-200">
                  {evaluation.status === 'failed' ? 'EXECUTION ERROR' : verdictFrom(evaluation.score, scoring.data?.verdictBands)}
                </div>
              </div>
              <div className="border-l border-bone-600/30 pl-6">
                <SystemLabel className="text-bone-600">OUTCOMES</SystemLabel>
                <div className="mt-1 font-mono text-sm text-bone-200">
                  <span className="text-flux-400">{evaluation.passed} passed</span>
                  {' · '}
                  <span className="text-fault-400">{evaluation.failed} failed</span>
                  {evaluation.warnings > 0 && (
                    <>
                      {' · '}
                      <span className="text-warn-400">{evaluation.warnings} warning</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Link
            to={`/app/compare?agent=${evaluation.agentId}`}
            className="group flex h-fit min-h-11 items-center gap-2 border border-signal-500/40 bg-signal-500/10 px-6 py-3 font-mono text-xs uppercase tracking-wider text-signal-400 transition-colors hover:bg-signal-500/20"
          >
            COMPARE VERSIONS{' '}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {evaluation.evaluator && (
          <ScrollReveal className="mt-8">
            <ProvenancePanel
              evaluationId={evaluation.id}
              provenance={evaluation.evaluator}
              onReanalyzed={reload}
            />
          </ScrollReveal>
        )}

        {gateApplied && (
          <ScrollReveal className="mt-8">
            <div className="border border-fault-500/30 bg-fault-500/5 p-5">
              <SystemLabel className="text-fault-400">SEVERITY CEILING APPLIED</SystemLabel>
              <p className="mt-2 text-sm text-bone-200">
                This run carries {gateApplied.when}
                {criticalFindings > 0 && ` (${criticalFindings} critical)`}, so its reliability is
                capped at {gateApplied.atMost} regardless of pass rate. A high pass rate cannot buy
                back a failure of this severity.
              </p>
            </div>
          </ScrollReveal>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ScrollReveal>
            <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
              <SystemLabel>RELIABILITY DIMENSIONS</SystemLabel>
              <div className="mt-6 grid gap-5">
                <MetricLine label="TASK SUCCESS" value={evaluation.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
                <MetricLine label="TOOL ACCURACY" value={evaluation.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} delay={0.1} />
                <MetricLine label="SAFETY" value={evaluation.metrics.safety} color={METRIC_COLORS.safety} delay={0.15} />
                <MetricLine label="CONSISTENCY" value={evaluation.metrics.consistency} color={METRIC_COLORS.consistency} delay={0.2} />
                <MetricLine label="GROUNDEDNESS" value={evaluation.metrics.groundedness} color={METRIC_COLORS.groundedness} delay={0.25} />
              </div>
              {scoring.data && (
                <div className="mt-6 border-t border-bone-600/20 pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-bone-600">
                    Weighted
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(scoring.data.weights).map(([key, weight]) => (
                      <li
                        key={key}
                        className="font-mono text-[10px] uppercase tracking-wider text-bone-600"
                      >
                        {key.replace(/_/g, ' ')} {Math.round(weight * 100)}%
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
              <SystemLabel>FAILURE CLASSES DETECTED</SystemLabel>
              <div className="mt-6">
                <FailureReveal
                  items={evaluation.failureBreakdown}
                  tests={evaluation.tests}
                  evaluationId={evaluation.id}
                />
              </div>
            </div>
          </ScrollReveal>
        </div>

        {evaluation.categories && evaluation.categories.length > 0 && (
          <ScrollReveal className="mt-6">
            <div className="border border-bone-600/20 bg-ink-900/60 p-6">
              <SystemLabel>BY SCENARIO CATEGORY</SystemLabel>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {evaluation.categories.map((c) => (
                  <div key={c.category} className="border border-bone-600/20 bg-ink-850/40 p-4">
                    <SystemLabel className="text-bone-500">{c.category.toUpperCase()}</SystemLabel>
                    <div className="mt-2 font-mono text-2xl font-bold text-bone-50">
                      {c.score.toFixed(1)}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-bone-500">
                      {c.passed}/{c.total} passed
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        )}

        {ciGate.data && (
          <ScrollReveal className="mt-6">
            <CiGatePanel gate={ciGate.data} />
          </ScrollReveal>
        )}

        <ScrollReveal className="mt-6">
          <GuardrailLadder
            report={guardrail.data}
            error={guardrail.error}
            running={ladderRunning || ladderStarting || guardrail.loading}
            onRun={runLadder}
          />
        </ScrollReveal>

        <ScrollReveal className="mt-6">
          <div className="border border-bone-600/20 bg-ink-900/60 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <SystemLabel>
                TEST RESULTS — {evaluation.tests.length} OF {evaluation.total} SCENARIOS
              </SystemLabel>
              <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`flex min-h-10 items-center border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      filter === f.key
                        ? 'border-signal-500/50 bg-signal-500/10 text-signal-400'
                        : 'border-bone-600/30 text-bone-500 hover:text-bone-200'
                    }`}
                  >
                    {f.label} {counts[f.key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {filteredTests.map((test) => (
                <TestResult key={test.id} test={test} evaluationId={evaluation.id} />
              ))}
            </div>

            {filteredTests.length === 0 && (
              <div className="py-12 text-center">
                <SystemLabel className="text-bone-600">
                  {evaluation.tests.length === 0
                    ? 'THIS RUN RETURNED NO SCENARIO RESULTS'
                    : 'NO TESTS MATCH THIS FILTER'}
                </SystemLabel>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
