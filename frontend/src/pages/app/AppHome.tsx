import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { MetricLine } from '@/components/MetricLine';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { METRIC_COLORS } from '@/lib/palette';
import { api } from '@/lib/api';
import { deltaTone, evaluationPath, evaluationVerdict, formatDate, hasAgentScore, signed } from '@/lib/format';
import { Plus, ArrowRight, TrendingUp, AlertTriangle, Activity, Bot } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buttonPrimary, buttonSecondary, card, sectionTitle } from '@/lib/ui';

export default function AppHome() {
  const workspace = useWorkspace();
  const agents = useResource(() => api.agents(), []);
  const dashboard = useResource(() => api.dashboard(), []);
  const evaluations = useResource(() => api.evaluations(), []);

  const loading = agents.loading || dashboard.loading || evaluations.loading;
  const error = agents.error ?? dashboard.error ?? evaluations.error;
  const reload = () => {
    agents.reload();
    dashboard.reload();
    evaluations.reload();
  };

  // The list endpoint returns evaluations newest first, so the head of it is the
  // latest run across every agent — the one the hero panel is describing.
  const latest = evaluations.data?.[0];
  const summary = dashboard.data;
  const canCreate = workspace.current?.role !== 'viewer';

  /*
   * Two populations, labelled as two populations.
   *
   * "Tests Executed 82" beside "Critical Failures 49" beside an average computed
   * from neither read as one set of runs. It was three: the average comes from the
   * latest run per scenario, the count included every rerun, and the findings
   * included guardrail probes. Each tile now names the set it describes, and the
   * all-activity numbers sit in their own group underneath.
   */
  const stats = summary
    ? [
        {
          icon: Bot,
          label: 'Agents tested',
          value: String(summary.agentsTested),
          color: 'text-signal-400',
          note: `${summary.evaluations ?? 0} recent evaluations`,
        },
        {
          icon: Activity,
          label: 'Scored scenarios',
          value: String(summary.scoredScenarios ?? summary.testsExecuted),
          color: 'text-spark-400',
          note: 'latest run per scenario',
        },
        {
          icon: TrendingUp,
          label: 'Avg reliability',
          value: summary.evaluations ? summary.averageReliability.toFixed(1) : '—',
          color: 'text-flux-400',
          note: summary.windowTruncated
            ? `mean across latest ${summary.windowLimit ?? 100}`
            : 'mean across recent evaluations',
        },
        {
          icon: AlertTriangle,
          label: 'Critical findings',
          value: String(summary.criticalFindings ?? summary.criticalFailures),
          color: 'text-fault-400',
          note: 'in the scored set',
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: workspace.current?.name ?? 'Workspace' }, { label: 'Overview' }]}
        title="Overview"
        description="The latest run, the numbers behind it, and every agent in this workspace."
        actions={canCreate && (
          <Link to="/app/agents/new" className={buttonPrimary}>
            <Plus className="h-4 w-4" aria-hidden /> New agent
          </Link>
        )}
      />

      {loading && <LoadingState label="Loading workspace" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <div className="space-y-8">
          {stats.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <li key={stat.label} className={`${card} flex min-w-0 items-start gap-4`}>
                  <stat.icon className={`mt-1 h-5 w-5 shrink-0 ${stat.color}`} strokeWidth={1.5} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm text-bone-300">{stat.label}</p>
                    <p className="mt-1 font-mono text-3xl font-semibold text-bone-50">{stat.value}</p>
                    <p className="mt-1 text-sm text-bone-400">{stat.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-3">
            <section className={`${card} min-w-0 lg:col-span-2`} aria-labelledby="latest-run">
              {latest ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 id="latest-run" className={sectionTitle}>Latest run</h2>
                      <p className="mt-1 break-words text-sm text-bone-300">
                        {latest.agentName} · {latest.version} · {formatDate(latest.date)}
                      </p>
                    </div>
                    <Link to={evaluationPath(latest)} className={`${buttonSecondary} shrink-0`}>
                      Open report <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>

                  {latest.status === 'completed' ? (
                    <div className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                      <ReliabilityScore score={latest.score} size="md" />
                      <div className="grid min-w-0 gap-4">
                        <MetricLine label="Task success" value={latest.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
                        <MetricLine label="Tool accuracy" value={latest.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} />
                        <MetricLine label="Safety" value={latest.metrics.safety} color={METRIC_COLORS.safety} />
                        <MetricLine label="Loop resistance" value={latest.metrics.consistency} color={METRIC_COLORS.consistency} />
                        <MetricLine label="Groundedness" value={latest.metrics.groundedness} color={METRIC_COLORS.groundedness} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 border border-dashed border-bone-600/40 p-6 text-center">
                      <p className="font-display text-lg font-semibold text-warn-400">{evaluationVerdict(latest)}</p>
                      <p className="mt-2 text-sm text-bone-300">Open the run to follow its progress or inspect the error.</p>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Nothing evaluated yet"
                  hint="Add an agent and run an evaluation. The reliability score appears here."
                />
              )}
            </section>

            {summary && (
              <div className="grid min-w-0 content-start gap-6">
                <section className={card}>
                  <h2 className={sectionTitle}>Verdict</h2>
                  <p className="mt-2 font-mono text-lg text-bone-50">{summary.evaluations ? summary.verdict : 'No scored runs'}</p>
                  <p className={`mt-1 text-sm ${deltaTone(summary.reliabilityDelta)}`}>
                    {signed(summary.reliabilityDelta)} since the previous run
                  </p>
                </section>
                <section className={card}>
                  <h2 className={sectionTitle}>All activity</h2>
                  <p className="mt-1 text-sm leading-relaxed text-bone-400">
                    Everything that ever executed, not only the set the average is computed from.
                  </p>
                  <dl className="mt-4 space-y-2">
                    {[
                      ['Total runs', summary.totalRuns],
                      ['Guardrail probes', summary.guardrailProbes],
                      ['Reruns & superseded', summary.rerunsAndSuperseded],
                      ['All-time critical findings', summary.allTimeCriticalFindings],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex items-baseline justify-between gap-3 text-sm">
                        <dt className="text-bone-300">{label}</dt>
                        <dd className="font-mono text-bone-50">{value ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            )}
          </div>

          <section className={`${card} min-w-0`} aria-labelledby="agent-list">
            <div className="flex items-center justify-between gap-3">
              <h2 id="agent-list" className={sectionTitle}>Your agents</h2>
              <Link to="/app/agents" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-signal-300 hover:text-signal-400">
                View all <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {agents.data && agents.data.length > 0 ? (
              <ul className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {agents.data.slice(0, 6).map((agent) => (
                  <li key={agent.id} className="min-w-0">
                    <Link
                      to={`/app/agents/${agent.id}`}
                      className="flex h-full min-w-0 items-center justify-between gap-3 border border-bone-600/30 bg-ink-850/40 p-4 transition-colors hover:border-signal-500/50 hover:bg-ink-800/40"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-bone-50">{agent.name}</p>
                        <p className="mt-0.5 text-sm text-bone-400">{agent.domain}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-2xl font-semibold text-bone-50">
                          {hasAgentScore(agent) ? agent.reliability.toFixed(1) : '—'}
                        </p>
                        <p className="text-sm text-bone-400">{agent.latestVersion}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No agents yet"
                  hint="Add your first agent with its system prompt and tools."
                  action={canCreate ? (
                    <Link to="/app/agents/new" className={`${buttonSecondary} mt-1`}>
                      <Plus className="h-4 w-4" aria-hidden /> New agent
                    </Link>
                  ) : undefined}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
