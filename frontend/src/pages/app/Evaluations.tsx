import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AsyncBoundary, EmptyState } from '@/components/AsyncState';
import { ScrollReveal } from '@/components/ScrollReveal';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { evaluationPath, evaluationVerdict, formatDate, scoreTone } from '@/lib/format';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { buttonPrimary } from '@/lib/ui';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const PAGE_SIZE = 40;

/**
 * Every evaluation ever run, newest first.
 *
 * The console could reach an evaluation only through the agent that owned it, so
 * a judge who wanted to compare v1-baseline against v3 had to know which agent to
 * open first. Run history is the spine of a regression story; it needs its own
 * screen.
 */
export default function Evaluations() {
  const workspace = useWorkspace();
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useResource(
    () => api.evaluations(PAGE_SIZE, page * PAGE_SIZE),
    [workspace.current?.id, page],
  );
  const [query, setQuery] = useState('');

  useEffect(() => setPage(0), [workspace.current?.id]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter(
      (e) =>
        e.agentName.toLowerCase().includes(needle) ||
        e.version.toLowerCase().includes(needle) ||
        evaluationVerdict(e).toLowerCase().includes(needle) || e.status.includes(needle),
    );
  }, [data, query]);

  return (
    <>
        <PageHeader
          crumbs={[{ label: 'Testing' }, { label: 'Runs' }]}
          title="RUNS"
          description="Every evaluation in this workspace, newest first. Open a run for its scenarios and traces."
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
                      className={`${buttonPrimary} mt-2`}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> New agent
                    </Link>
                  )
                }
              />
            ) : (
              <div className="space-y-2">
                {rows.map((evaluation, i) => {
                  const delta = evaluation.score - (evaluation.previousScore ?? 0);
                  return (
                    <ScrollReveal key={evaluation.id} delay={Math.min(i, 8) * 0.03}>
                      <Link
                        to={evaluationPath(evaluation)}
                        className="group grid min-w-0 grid-cols-1 items-center gap-3 border border-bone-600/20 bg-ink-900/60 p-4 transition-colors hover:border-signal-500/35 hover:bg-ink-850/50 sm:grid-cols-[1fr_auto] sm:p-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-words text-sm text-bone-100">
                              {evaluation.agentName}
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-wider text-signal-400">
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
                            {(evaluation.errors ?? 0) > 0 && (
                              <span className="text-fault-400"> · {evaluation.errors} execution errors</span>
                            )}
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
                              {evaluation.status === 'completed' ? evaluation.score.toFixed(1) : '—'}
                            </div>
                            <div className="font-mono text-[10px] text-bone-500">
                              {evaluationVerdict(evaluation)}
                              {evaluation.status === 'completed' && evaluation.previousScore !== null && (
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
                          <ArrowRight className="h-4 w-4 shrink-0 text-bone-600 transition-transform group-hover:translate-x-1 group-hover:text-signal-400" />
                        </div>
                      </Link>
                    </ScrollReveal>
                  );
                })}
                {(page > 0 || (data?.length ?? 0) === PAGE_SIZE) && (
                  <div className="mt-6 flex items-center justify-between border-t border-bone-600/20 pt-5">
                    <button type="button" disabled={page === 0}
                      onClick={() => setPage((value) => Math.max(value - 1, 0))}
                      className="min-h-10 px-3 font-mono text-xs uppercase text-bone-300 hover:text-bone-50 disabled:opacity-30">Newer</button>
                    <span className="font-mono text-xs text-bone-500">Page {page + 1}</span>
                    <button type="button" disabled={(data?.length ?? 0) < PAGE_SIZE}
                      onClick={() => setPage((value) => value + 1)}
                      className="min-h-10 px-3 font-mono text-xs uppercase text-bone-300 hover:text-bone-50 disabled:opacity-30">Older</button>
                  </div>
                )}
              </div>
            )}
          </AsyncBoundary>
        </div>
    </>
  );
}
