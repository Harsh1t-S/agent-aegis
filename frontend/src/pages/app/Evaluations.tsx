import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AsyncBoundary, EmptyState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { evaluationPath, evaluationVerdict, formatDate, scoreTone } from '@/lib/format';
import { ArrowRight, Play, Plus, Search } from 'lucide-react';
import { buttonPrimary, buttonSecondary, fieldInput } from '@/lib/ui';
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
          title="Runs"
          description="Every evaluation in this workspace, newest first. Open a run for its scenarios and traces."
          actions={workspace.current?.role !== 'viewer' && (
            <Link to="/app/agents" className={buttonPrimary}>
              <Play className="h-4 w-4" aria-hidden /> Start a run
            </Link>
          )}
        />

        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-400" aria-hidden />
            <input
              aria-label="Filter runs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by agent, version or verdict"
              className={`${fieldInput} pl-10`}
            />
          </div>
        </div>

        <div>
          <AsyncBoundary
            loading={loading}
            error={error}
            onRetry={reload}
            label="Loading evaluations"
          >
            {rows.length === 0 ? (
              <EmptyState
                title={data?.length ? 'Nothing matches that filter' : 'No runs yet'}
                hint={
                  data?.length
                    ? undefined
                    : 'Add an agent and run an evaluation. Every run appears here with its score, outcomes and verdict.'
                }
                action={
                  data?.length ? undefined : (
                    <Link
                      to="/app/agents/new"
                      className={`${buttonSecondary} mt-2`}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> New agent
                    </Link>
                  )
                }
              />
            ) : (
              <div className="space-y-2">
                {rows.map((evaluation) => {
                  const delta = evaluation.score - (evaluation.previousScore ?? 0);
                  return (
                    <div key={evaluation.id}>
                      <Link
                        to={evaluationPath(evaluation)}
                        className="group grid min-w-0 grid-cols-1 items-center gap-3 border border-bone-600/30 bg-ink-900 p-4 transition-colors hover:border-signal-500/50 hover:bg-ink-850 sm:grid-cols-[1fr_auto] sm:p-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-words text-base font-medium text-bone-50">
                              {evaluation.agentName}
                            </span>
                            <span className="font-mono text-sm text-signal-300">
                              {evaluation.version}
                            </span>
                            {evaluation.status !== 'completed' && (
                              <span className="border border-warn-500/50 px-2 text-sm text-warn-400">
                                {evaluation.status}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-bone-300">
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
                            <div className="text-sm text-bone-300">
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
                          <ArrowRight className="h-4 w-4 shrink-0 text-bone-400 transition-transform group-hover:translate-x-1 group-hover:text-signal-400" />
                        </div>
                      </Link>
                    </div>
                  );
                })}
                {(page > 0 || (data?.length ?? 0) === PAGE_SIZE) && (
                  <div className="mt-6 flex items-center justify-between border-t border-bone-600/20 pt-5">
                    <button type="button" disabled={page === 0}
                      onClick={() => setPage((value) => Math.max(value - 1, 0))}
                      className={buttonSecondary}>Newer</button>
                    <span className="text-sm text-bone-300">Page {page + 1}</span>
                    <button type="button" disabled={(data?.length ?? 0) < PAGE_SIZE}
                      onClick={() => setPage((value) => value + 1)}
                      className={buttonSecondary}>Older</button>
                  </div>
                )}
              </div>
            )}
          </AsyncBoundary>
        </div>
    </>
  );
}
