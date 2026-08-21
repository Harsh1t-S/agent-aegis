import { Link } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { MetricLine } from '@/components/MetricLine';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { METRIC_COLORS } from '@/lib/palette';
import { api } from '@/lib/api';
import { deltaTone, formatDate, signed } from '@/lib/format';
import { Plus, ArrowRight, TrendingUp, AlertTriangle, Activity, Bot } from 'lucide-react';

export default function AppHome() {
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
          label: 'AGENTS TESTED',
          value: String(summary.agentsTested),
          color: 'text-violet-400',
          note: `${summary.evaluations ?? 0} evaluations`,
        },
        {
          icon: Activity,
          label: 'SCORED SCENARIOS',
          value: String(summary.scoredScenarios ?? summary.testsExecuted),
          color: 'text-spark-400',
          note: 'latest run per scenario',
        },
        {
          icon: TrendingUp,
          label: 'AVG RELIABILITY',
          value: summary.averageReliability.toFixed(1),
          color: 'text-flux-400',
          note: 'mean across evaluations',
        },
        {
          icon: AlertTriangle,
          label: 'CRITICAL FINDINGS',
          value: String(summary.criticalFindings ?? summary.criticalFailures),
          color: 'text-fault-400',
          note: 'in the scored set',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>AEGIS / CONTROL CENTER</SystemLabel>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h1 className="massive text-[clamp(2rem,6vw,4.5rem)] text-bone-50">YOUR AGENTS.</h1>
            <h1 className="massive text-[clamp(2rem,6vw,4.5rem)] text-violet-400">UNDER PRESSURE.</h1>
          </div>
          <Link
            to="/app/agents/new"
            className="group flex h-fit items-center gap-2 border border-violet-500/40 bg-violet-500/10 px-6 py-3 font-mono text-xs uppercase tracking-wider text-violet-400 transition-colors hover:bg-violet-500/20"
          >
            <Plus className="h-4 w-4" />
            INITIALIZE NEW AGENT
          </Link>
        </div>

        {loading && <LoadingState label="LOADING WORKSPACE" />}
        {!loading && error && (
          <div className="mt-12">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-12 grid min-w-0 gap-6 lg:grid-cols-3">
              <ScrollReveal className="min-w-0 lg:col-span-2">
                <div className="noise relative flex min-h-[320px] flex-col border border-bone-600/20 bg-gradient-to-br from-ink-900/80 to-ink-850/50 p-5 sm:min-h-[400px] sm:p-8">
                  {latest ? (
                    <>
                      {/* These two labels were pinned with `absolute`, so a long
                          agent name had nothing to wrap against and pushed the
                          page 39px past the viewport. */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <SystemLabel>LATEST EVALUATION</SystemLabel>
                        <div className="min-w-0 sm:text-right">
                          <SystemLabel className="break-words text-bone-500">
                            {latest.agentName}
                          </SystemLabel>
                          <div className="mt-1 font-mono text-xs text-bone-400">
                            {latest.version} · {formatDate(latest.date)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex min-w-0 flex-1 flex-col items-center justify-center">
                      <ReliabilityScore score={latest.score} size="xl" />

                      <div className="mt-8 grid w-full min-w-0 max-w-md gap-4">
                        <MetricLine label="TASK SUCCESS" value={latest.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
                        <MetricLine label="TOOL ACCURACY" value={latest.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} />
                        <MetricLine label="SAFETY" value={latest.metrics.safety} color={METRIC_COLORS.safety} />
                        <MetricLine label="CONSISTENCY" value={latest.metrics.consistency} color={METRIC_COLORS.consistency} delay={0.1} />
                        <MetricLine label="GROUNDEDNESS" value={latest.metrics.groundedness} color={METRIC_COLORS.groundedness} delay={0.15} />
                      </div>

                      <Link
                        to={`/app/evaluations/${latest.id}`}
                        className="mt-8 flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:text-violet-300"
                      >
                        OPEN FULL REPORT <ArrowRight className="h-3 w-3" />
                      </Link>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title="NOTHING EVALUATED YET"
                      hint="Register an agent and run an evaluation — the reliability score appears here."
                    />
                  )}
                </div>
              </ScrollReveal>

              <div className="space-y-6">
                {stats.map((stat, i) => (
                  <ScrollReveal key={stat.label} delay={i * 0.08}>
                    <div className="group flex items-center justify-between border border-bone-600/20 bg-ink-850/40 p-5 transition-colors hover:border-violet-500/30">
                      <div className="flex min-w-0 items-center gap-4">
                        <stat.icon className={`h-5 w-5 shrink-0 ${stat.color}`} strokeWidth={1.5} />
                        <div className="min-w-0">
                          <SystemLabel>{stat.label}</SystemLabel>
                          <div className="mt-0.5 font-mono text-[10px] text-bone-600">
                            {stat.note}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-2xl font-bold text-bone-50">
                        {stat.value}
                      </span>
                    </div>
                  </ScrollReveal>
                ))}
                {summary && (
                  <ScrollReveal delay={0.36}>
                    <div className="border border-bone-600/20 bg-ink-850/40 p-5">
                      <SystemLabel className="text-bone-600">ALL ACTIVITY</SystemLabel>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-bone-600">
                        Everything that ever executed — not the set the average above is
                        computed from.
                      </p>
                      <dl className="mt-3 space-y-1">
                        {[
                          ['Total runs', summary.totalRuns],
                          ['Guardrail probes', summary.guardrailProbes],
                          ['Reruns & superseded', summary.rerunsAndSuperseded],
                          ['All-time critical findings', summary.allTimeCriticalFindings],
                        ].map(([label, value]) => (
                          <div
                            key={String(label)}
                            className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
                          >
                            <dt className="text-bone-500">{label}</dt>
                            <dd className="text-bone-200">{value ?? 0}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </ScrollReveal>
                )}
                {summary && (
                  <ScrollReveal delay={0.32}>
                    <div className="border border-bone-600/20 bg-ink-850/40 p-5">
                      <SystemLabel>VERDICT</SystemLabel>
                      <div className="mt-2 font-mono text-lg text-bone-50">{summary.verdict}</div>
                      <div className={`mt-1 font-mono text-xs ${deltaTone(summary.reliabilityDelta)}`}>
                        {signed(summary.reliabilityDelta)} since the previous evaluation
                      </div>
                    </div>
                  </ScrollReveal>
                )}
              </div>
            </div>

            <ScrollReveal className="mt-6">
              <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <SystemLabel>AGENT NETWORK</SystemLabel>
                  <Link
                    to="/app/agents"
                    className="group flex min-h-11 shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:text-violet-300"
                  >
                    VIEW ALL <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
                {agents.data && agents.data.length > 0 ? (
                  <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {agents.data.slice(0, 6).map((agent, i) => (
                      <Link
                        key={agent.id}
                        to={`/app/agents/${agent.id}`}
                        className="group flex min-w-0 items-center justify-between gap-3 border border-bone-600/20 bg-ink-850/40 p-4 transition-all hover:border-violet-500/30 hover:bg-ink-800/40"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] text-bone-600">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div className="mt-1 break-words text-sm text-bone-100">{agent.name}</div>
                          <div className="font-mono text-[10px] text-bone-500">{agent.domain}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-xl font-bold text-bone-50 sm:text-2xl">
                            {agent.status === 'never-run' ? '—' : agent.reliability.toFixed(1)}
                          </div>
                          <div className="font-mono text-[10px] text-bone-500">{agent.latestVersion}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6">
                    <EmptyState title="NO AGENTS REGISTERED" />
                  </div>
                )}
              </div>
            </ScrollReveal>
          </>
        )}
      </div>
    </div>
  );
}
