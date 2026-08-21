import { Link } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { MetricLine } from '@/components/MetricLine';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
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

  const stats = summary
    ? [
        { icon: Bot, label: 'AGENTS TESTED', value: String(summary.agentsTested), color: 'text-violet-400' },
        { icon: Activity, label: 'TESTS EXECUTED', value: String(summary.testsExecuted), color: 'text-spark-400' },
        {
          icon: TrendingUp,
          label: 'AVG RELIABILITY',
          value: summary.averageReliability.toFixed(1),
          color: 'text-flux-400',
        },
        {
          icon: AlertTriangle,
          label: 'CRITICAL FINDINGS',
          value: String(summary.criticalFailures),
          color: 'text-fault-400',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-6 py-8 md:px-10">
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
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              <ScrollReveal className="lg:col-span-2">
                <div className="noise relative flex min-h-[400px] flex-col items-center justify-center border border-bone-600/20 bg-gradient-to-br from-ink-900/80 to-ink-850/50 p-8">
                  {latest ? (
                    <>
                      <div className="absolute left-6 top-6">
                        <SystemLabel>LATEST EVALUATION</SystemLabel>
                      </div>
                      <div className="absolute right-6 top-6 text-right">
                        <SystemLabel className="text-bone-500">{latest.agentName}</SystemLabel>
                        <div className="mt-1 font-mono text-xs text-bone-400">
                          {latest.version} · {formatDate(latest.date)}
                        </div>
                      </div>

                      <ReliabilityScore score={latest.score} size="xl" />

                      <div className="mt-8 grid w-full max-w-md gap-4">
                        <MetricLine label="TASK SUCCESS" value={latest.metrics.taskSuccess} color="#8b5cf6" />
                        <MetricLine label="TOOL ACCURACY" value={latest.metrics.toolAccuracy} color="#0ea5e9" />
                        <MetricLine label="SAFETY" value={latest.metrics.safety} color="#22c55e" />
                        <MetricLine label="CONSISTENCY" value={latest.metrics.consistency} color="#a78bfa" delay={0.1} />
                        <MetricLine label="GROUNDEDNESS" value={latest.metrics.groundedness} color="#f59e0b" delay={0.15} />
                      </div>

                      <Link
                        to={`/app/evaluations/${latest.id}`}
                        className="mt-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:text-violet-300"
                      >
                        OPEN FULL REPORT <ArrowRight className="h-3 w-3" />
                      </Link>
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
                      <div className="flex items-center gap-4">
                        <stat.icon className={`h-5 w-5 ${stat.color}`} strokeWidth={1.5} />
                        <SystemLabel>{stat.label}</SystemLabel>
                      </div>
                      <span className="font-mono text-2xl font-bold text-bone-50">{stat.value}</span>
                    </div>
                  </ScrollReveal>
                ))}
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
              <div className="border border-bone-600/20 bg-ink-900/60 p-6">
                <div className="flex items-center justify-between">
                  <SystemLabel>AGENT NETWORK</SystemLabel>
                  <Link
                    to="/app/agents"
                    className="group flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:text-violet-300"
                  >
                    VIEW ALL <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
                {agents.data && agents.data.length > 0 ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {agents.data.slice(0, 6).map((agent, i) => (
                      <Link
                        key={agent.id}
                        to={`/app/agents/${agent.id}`}
                        className="group flex items-center justify-between gap-4 border border-bone-600/20 bg-ink-850/40 p-4 transition-all hover:border-violet-500/30 hover:bg-ink-800/40"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] text-bone-600">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div className="mt-1 truncate text-sm text-bone-100">{agent.name}</div>
                          <div className="font-mono text-[10px] text-bone-500">{agent.domain}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-2xl font-bold text-bone-50">
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
