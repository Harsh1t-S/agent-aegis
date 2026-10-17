import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { VersionBattle } from '@/components/VersionBattle';
import { buttonPrimary, buttonSecondary, card } from '@/lib/ui';
import { evaluationPath } from '@/lib/format';
import { ArrowRight } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const agents = useResource(() => api.agents(), []);

  const comparable = useMemo(
    () => (agents.data ?? []).map((a) => ({ ...a,
      versions: a.versions.filter((v) => !v.status || v.status === 'completed'),
    })).filter((a) => a.versions.length > 1),
    [agents.data],
  );

  const requested = params.get('agent');
  const agent =
    comparable.find((a) => a.id === requested) ?? comparable[0];

  const requestedLeft = agent?.versions.find((v) => v.id === params.get('baseline'));
  const right = agent?.versions.find((v) => v.id === params.get('target') && v.id !== requestedLeft?.id)
    ?? agent?.versions.filter((v) => v.id !== requestedLeft?.id).slice(-1)[0];
  const left = requestedLeft ?? agent?.versions.filter((v) => v.id !== right?.id).slice(-1)[0];
  const leftId = left?.id;
  const rightId = right?.id;

  // Include the resolved defaults too: opening a shared URL next week should
  // still compare this pair after more versions have been evaluated.
  useEffect(() => {
    if (!agent || !leftId || !rightId) return;
    if (params.get('agent') !== agent.id || params.get('baseline') !== leftId || params.get('target') !== rightId) {
      setParams({ agent: agent.id, baseline: leftId, target: rightId }, { replace: true });
    }
  }, [agent, leftId, rightId, params, setParams]);

  const diff = useResource(
    () => api.compare(leftId as string, rightId as string),
    [leftId, rightId],
    { enabled: Boolean(leftId && rightId && leftId !== rightId) },
  );

  return (
    <>
        <PageHeader
          crumbs={[{ label: 'Testing' }, { label: 'Compare versions' }]}
          title="Compare versions"
          description="Pick an agent and two of its versions. Only scenarios both versions ran are compared."
          actions={agent && left && right && (
            <>
              <Link to={evaluationPath(left)} className={buttonSecondary}>Open {left.version} report</Link>
              <Link to={evaluationPath(right)} className={buttonPrimary}>
                Open {right.version} report <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          )}
        />

        {agents.loading && <LoadingState label="Loading agents" />}
        {agents.error && <ErrorState message={agents.error} onRetry={agents.reload} />}

        {!agents.loading && !agents.error && comparable.length === 0 && (
          <div>
            <EmptyState
              title="Nothing to compare yet"
              hint="An agent needs at least two evaluated versions before a regression diff is possible. Run a second evaluation on any agent."
            />
          </div>
        )}

        {agent && left && right && (
          <>
            {comparable.length > 1 && (
              <div className="mb-6">
                <div className={card}>
                  <h2 className="text-sm font-medium text-bone-200">Agent</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comparable.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setParams({ agent: a.id })}
                        className={`flex min-h-11 items-center border px-4 text-sm transition-colors ${
                          a.id === agent.id
                            ? 'border-signal-400 bg-signal-500/15 font-medium text-signal-300'
                            : 'border-bone-600/40 text-bone-200 hover:border-bone-300/60 hover:text-bone-50'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6">
              <div className="grid min-w-0 gap-6 md:grid-cols-2">
                <div className={card}>
                  <h2 className="text-sm font-medium text-bone-200">Baseline version</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agent.versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setParams({ agent: agent.id, baseline: v.id, target: right.id })}
                        disabled={v.id === rightId}
                        className={`flex min-h-11 items-center border px-4 text-sm transition-colors disabled:opacity-30 ${
                          v.id === leftId
                            ? 'border-bone-300 bg-bone-600/20 font-medium text-bone-50'
                            : 'border-bone-600/40 text-bone-200 hover:border-bone-300/60 hover:text-bone-50'
                        }`}
                      >
                        {v.version}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border border-signal-500/40 bg-signal-500/5 p-4 sm:p-6">
                  <h2 className="text-sm font-medium text-signal-300">Comparing against</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agent.versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setParams({ agent: agent.id, baseline: left.id, target: v.id })}
                        disabled={v.id === leftId}
                        className={`flex min-h-11 items-center border px-4 text-sm transition-colors disabled:opacity-30 ${
                          v.id === rightId
                            ? 'border-signal-400 bg-signal-500/15 font-medium text-signal-300'
                            : 'border-bone-600/40 text-bone-200 hover:border-bone-300/60 hover:text-bone-50'
                        }`}
                      >
                        {v.version}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <VersionBattle
                left={left}
                right={right}
                diff={diff.data}
                diffError={diff.error}
              />
            </div>
          </>
        )}
    </>
  );
}
