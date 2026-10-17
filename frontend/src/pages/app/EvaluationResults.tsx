import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { NextSteps, PageHeader } from '@/components/PageHeader';
import { MetricLine } from '@/components/MetricLine';
import { FailureReveal } from '@/components/FailureReveal';
import { TestResult } from '@/components/TestResult';
import { CiGatePanel } from '@/components/CiGatePanel';
import { ProvenancePanel } from '@/components/ProvenancePanel';
import { useToast } from '@/components/Toaster';
import { GuardrailLadder } from '@/components/GuardrailLadder';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { METRIC_COLORS } from '@/lib/palette';
import { api, ApiError } from '@/lib/api';
import { deltaTone, evaluationPath, formatDate, isEvaluationActive, signed, verdictFrom } from '@/lib/format';
import type { TestStatus } from '@/types';
import { Download, GitCompareArrows } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ReportSharing } from '@/components/ReportSharing';
import { buttonPrimary, buttonSecondary, card, sectionTitle } from '@/lib/ui';

type Filter = 'all' | TestStatus;

export default function EvaluationResults() {
  const { id } = useParams<{ id: string }>();
  const workspace = useWorkspace();
  const canMutate = workspace.current?.role !== 'viewer';
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

  const exportReport = () => {
    if (!evaluation) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      notice: 'Private workspace export. Share only with intended recipients.',
      evaluation,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `aegis-${evaluation.agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${evaluation.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
      <LoadingState label="Loading report" />
    );
  }

  if (error || !evaluation) {
    return (
      <div className="py-8">
        <ErrorState message={error ?? 'Evaluation not found.'} onRetry={reload} />
        <div className="mt-6 text-center">
          <Link to="/app/evaluations" className={buttonSecondary}>Back to runs</Link>
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
    { key: 'all', label: 'All' },
    { key: 'passed', label: 'Passed' },
    { key: 'failed', label: 'Failed' },
    { key: 'warning', label: 'Warning' },
  ];

  const delta = evaluation.previousScore === null ? null : evaluation.score - evaluation.previousScore;
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

  const noScore = evaluation.tests.length === evaluation.errors;
  const failedTests = evaluation.tests.filter((t) => t.status === 'failed');
  const nextSteps = [
    ...(failedTests.length > 0
      ? [{
          to: `/app/evaluations/${evaluation.id}/tests/${failedTests[0].id}`,
          label: 'Open the first failing scenario',
          hint: `See the trace: ${failedTests[0].title}`,
        }]
      : []),
    { to: `/app/compare?agent=${evaluation.agentId}`, label: 'Compare versions', hint: 'Put this run next to another version.' },
    ...(canMutate
      ? [{ to: `/app/agents/${evaluation.agentId}/review`, label: 'Fix the agent and run again', hint: 'Edit the prompt or tools, then re-run the suite.' }]
      : []),
  ];

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Runs', to: '/app/evaluations' },
          { label: evaluation.agentName, to: `/app/agents/${evaluation.agentId}` },
          { label: evaluation.version },
        ]}
        title="Reliability report"
        description={`${evaluation.agentName} · ${evaluation.version} · ${formatDate(evaluation.date)}`}
        actions={(
          <>
            <button type="button" onClick={exportReport} className={buttonSecondary}>
              <Download className="h-4 w-4" aria-hidden /> Export JSON
            </button>
            <Link to={`/app/compare?agent=${evaluation.agentId}`} className={buttonPrimary}>
              <GitCompareArrows className="h-4 w-4" aria-hidden /> Compare versions
            </Link>
          </>
        )}
      />

      <div className="space-y-6">
        {(evaluation.errors ?? 0) > 0 && (
          <div role="alert" className="border border-fault-500/40 bg-fault-500/10 p-4 text-sm text-bone-100">
            {evaluation.errors} scenario execution{evaluation.errors === 1 ? '' : 's'} failed.
            {' '}The score covers completed scenarios only. Review the error traces and rerun them; this evaluation cannot pass CI.
          </div>
        )}

        <section className={card} aria-label="Summary">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-bone-300">Reliability score</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-5xl font-bold text-bone-50">
                  {noScore ? '—' : evaluation.score.toFixed(1)}
                </span>
                <span className="font-mono text-lg text-bone-400">/100</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-bone-300">Previous run</dt>
              <dd className="mt-1 font-mono text-2xl text-bone-100">
                {evaluation.previousScore === null ? '—' : evaluation.previousScore.toFixed(1)}
              </dd>
              <dd className={`mt-1 text-sm ${delta === null ? 'text-bone-400' : deltaTone(delta)}`}>
                {delta === null ? 'First run' : signed(delta)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-bone-300">Verdict</dt>
              <dd className="mt-1 font-display text-xl font-semibold text-bone-50">
                {evaluation.status === 'failed' ? 'Execution error' : verdictFrom(evaluation.score, scoring.data?.verdictBands)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-bone-300">Outcomes</dt>
              <dd className="mt-1 text-base">
                <span className="text-flux-400">{evaluation.passed} passed</span>
                {' · '}
                <span className="text-fault-400">{evaluation.failed} failed</span>
                {evaluation.warnings > 0 && (
                  <>
                    {' · '}
                    <span className="text-warn-400">{evaluation.warnings} warning</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {gateApplied && (
          <div className="border border-fault-500/40 bg-fault-500/5 p-5">
            <h2 className="font-display text-lg font-semibold text-fault-300">Severity ceiling applied</h2>
            <p className="mt-2 text-sm leading-relaxed text-bone-200">
              This run carries {gateApplied.when}
              {criticalFindings > 0 && ` (${criticalFindings} critical)`}, so its reliability is
              capped at {gateApplied.atMost} regardless of pass rate. A high pass rate cannot buy
              back a failure of this severity.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`${card} min-w-0`}>
            <h2 className={sectionTitle}>Reliability dimensions</h2>
            <div className="mt-5 grid gap-5">
              <MetricLine label="Task success" value={evaluation.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
              <MetricLine label="Tool accuracy" value={evaluation.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} />
              <MetricLine label="Safety" value={evaluation.metrics.safety} color={METRIC_COLORS.safety} />
              <MetricLine label="Loop resistance" value={evaluation.metrics.consistency} color={METRIC_COLORS.consistency} />
              <MetricLine label="Groundedness" value={evaluation.metrics.groundedness} color={METRIC_COLORS.groundedness} />
            </div>
            {scoring.data && (
              <div className="mt-6 border-t border-bone-600/25 pt-4">
                <p className="text-sm font-medium text-bone-200">Weighting</p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(scoring.data.weights).map(([key, weight]) => (
                    <li key={key} className="text-sm text-bone-300">
                      {key.replace(/_/g, ' ')} {Math.round(weight * 100)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={`${card} min-w-0`}>
            <h2 className={sectionTitle}>Failure classes detected</h2>
            <div className="mt-5">
              <FailureReveal
                items={evaluation.failureBreakdown}
                tests={evaluation.tests}
                evaluationId={evaluation.id}
              />
            </div>
          </section>
        </div>

        {evaluation.categories && evaluation.categories.length > 0 && (
          <section className={card}>
            <h2 className={sectionTitle}>By scenario category</h2>
            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {evaluation.categories.map((c) => (
                <li key={c.category} className="border border-bone-600/30 bg-ink-850/40 p-4">
                  <p className="text-sm text-bone-300">{c.category}</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-bone-50">{c.score.toFixed(1)}</p>
                  <p className="mt-1 text-sm text-bone-400">{c.passed}/{c.total} passed</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={card} aria-label="Scenario results">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className={sectionTitle}>
              Scenario results <span className="font-sans text-sm font-normal text-bone-300">({evaluation.tests.length} of {evaluation.total})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter scenarios">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex min-h-11 items-center border px-4 text-sm transition-colors ${
                    filter === f.key
                      ? 'border-signal-400 bg-signal-500/15 font-medium text-signal-300'
                      : 'border-bone-600/40 text-bone-200 hover:border-bone-300/60 hover:text-bone-50'
                  }`}
                >
                  {f.label} {counts[f.key]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {filteredTests.map((test) => (
              <TestResult key={test.id} test={test} evaluationId={evaluation.id} />
            ))}
          </div>

          {filteredTests.length === 0 && (
            <p className="py-10 text-center text-sm text-bone-300">
              {evaluation.tests.length === 0
                ? 'This run returned no scenario results.'
                : 'No scenarios match this filter.'}
            </p>
          )}
        </section>

        <NextSteps steps={nextSteps} />

        <section aria-label="Evidence and sharing" className="space-y-6 border-t border-bone-600/20 pt-8">
          <h2 className={sectionTitle}>Evidence and sharing</h2>
          {canMutate && <ReportSharing evaluationId={evaluation.id} />}
          {evaluation.evaluator && (
            <ProvenancePanel
              evaluationId={evaluation.id}
              provenance={evaluation.evaluator}
              onReanalyzed={reload}
              canReanalyze={canMutate}
            />
          )}
          {ciGate.data && <CiGatePanel gate={ciGate.data} />}
          <GuardrailLadder
            report={guardrail.data}
            error={guardrail.error}
            running={ladderRunning || ladderStarting || guardrail.loading}
            onRun={runLadder}
            canRun={canMutate}
          />
        </section>
      </div>
    </>
  );
}
