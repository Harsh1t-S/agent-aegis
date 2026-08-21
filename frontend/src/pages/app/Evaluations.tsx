import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { SystemLabel } from '@/components/SystemLabel';
import { MassiveHeading } from '@/components/MassiveHeading';
import { AsyncBoundary, EmptyState } from '@/components/AsyncState';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { formatDate, scoreTone, verdictFor } from '@/lib/format';
import { ArrowRight, Search } from 'lucide-react';

/**
 * Every evaluation ever run, newest first.
 *
 * The console could reach an evaluation only through the agent that owned it, so
 * a judge who wanted to compare v1-baseline against v3 had to know which agent to
 * open first. Run history is the spine of a regression story; it needs its own
 * screen.
 */
export default function Evaluations() {
  const { data, error, loading, reload } = useResource(() => api.evaluations(), []);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter(
      (e) =>
        e.agentName.toLowerCase().includes(needle) ||
        e.version.toLowerCase().includes(needle) ||
        verdictFor(e.score).toLowerCase().includes(needle),
    );
  }, [data, query]);

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>EVALUATIONS / HISTORY</SystemLabel>
        <MassiveHeading
          lines={['EVERY RUN.', 'IN ORDER.']}
          className="mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50"
        />

        <div className="mt-8 max-w-md">
          <div className="flex items-center gap-2 border border-bone-600/25 bg-ink-900/60 px-3">
            <Search className="h-4 w-4 shrink-0 text-bone-500" />
            <input
              aria-label="Filter evaluations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by agent, version or verdict"
              className="min-h-11 w-full bg-transparent font-mono text-base text-bone-100 placeholder:text-bone-600 focus:outline-none sm:text-sm"
            />
          </div>
        </div>

        <div className="mt-8">
          <AsyncBoundary
            loading={loading}
            error={error}
            onRetry={reload}
            label="LOADING EVALUATIONS"
          >
            {rows.length === 0 ? (
              <EmptyState
                title={data?.length ? 'NOTHING MATCHES THAT FILTER' : 'NO EVALUATIONS YET'}
                hint={
                  data?.length
                    ? undefined
                    : 'Register an agent and run an evaluation — every run appears here with its score, outcomes and verdict.'
                }
                action={
                  data?.length ? undefined : (
                    <Link
                      to="/app/agents/new"
                      className="mt-2 border border-violet-500/40 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:bg-violet-500/10"
                    >
                      INITIALIZE NEW AGENT
                    </Link>
                  )
                }
              />
            ) : (
              <div className="space-y-2">
                {rows.map((evaluation, i) => {
                  const delta = evaluation.score - evaluation.previousScore;
                  return (
                    <ScrollReveal key={evaluation.id} delay={Math.min(i, 8) * 0.03}>
                      <Link
                        to={`/app/evaluations/${evaluation.id}`}
                        className="group grid min-w-0 grid-cols-1 items-center gap-3 border border-bone-600/20 bg-ink-900/60 p-4 transition-colors hover:border-violet-500/35 hover:bg-ink-850/50 sm:grid-cols-[1fr_auto] sm:p-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-words text-sm text-bone-100">
                              {evaluation.agentName}
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-wider text-violet-400">
                              {evaluation.version}
                            </span>
                            {evaluation.status !== 'completed' && (
                              <span className="border border-warn-500/40 px-1.5 font-mono text-[9px] uppercase tracking-wider text-warn-400">
                                {evaluation.status}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-bone-500">
                            {formatDate(evaluation.date)} · {evaluation.total} scenarios ·{' '}
                            <span className="text-flux-400">{evaluation.passed} passed</span>
                            {' · '}
                            <span className="text-fault-400">{evaluation.failed} failed</span>
                            {evaluation.warnings > 0 && (
                              <>
                                {' · '}
                                <span className="text-warn-400">
                                  {evaluation.warnings} warning
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="text-right">
                            <div
                              className={`font-mono text-2xl font-bold ${scoreTone(evaluation.score)}`}
                            >
                              {evaluation.score.toFixed(1)}
                            </div>
                            <div className="font-mono text-[10px] text-bone-500">
                              {verdictFor(evaluation.score)}
                              {evaluation.previousScore > 0 && (
                                <>
                                  {' · '}
                                  <span
                                    className={
                                      delta >= 0 ? 'text-flux-400' : 'text-fault-400'
                                    }
                                  >
                                    {delta >= 0 ? '+' : ''}
                                    {delta.toFixed(1)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-bone-600 transition-transform group-hover:translate-x-1 group-hover:text-violet-400" />
                        </div>
                      </Link>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
          </AsyncBoundary>
        </div>
      </div>
    </div>
  );
}
