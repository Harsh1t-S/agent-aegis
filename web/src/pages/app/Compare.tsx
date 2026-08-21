import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { VersionBattle } from '@/components/VersionBattle';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const agents = useResource(() => api.agents(), []);

  const comparable = useMemo(
    () => (agents.data ?? []).filter((a) => a.versions.length > 1),
    [agents.data],
  );

  const requested = params.get('agent');
  const agent =
    comparable.find((a) => a.id === requested) ?? comparable[0];

  const [leftId, setLeftId] = useState<string | undefined>();
  const [rightId, setRightId] = useState<string | undefined>();

  // Default to the two most recent versions whenever the selected agent changes.
  useEffect(() => {
    if (!agent) return;
    const versions = agent.versions;
    setLeftId(versions[versions.length - 2].id);
    setRightId(versions[versions.length - 1].id);
  }, [agent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = agent?.versions.find((v) => v.id === leftId);
  const right = agent?.versions.find((v) => v.id === rightId);

  const diff = useResource(
    () => api.compare(leftId as string, rightId as string),
    [leftId, rightId],
    { enabled: Boolean(leftId && rightId && leftId !== rightId) },
  );

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-6 py-8 md:px-10">
        <SystemLabel>VERSION COMPARISON</SystemLabel>
        <h1 className="massive mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50">COMPARE.</h1>

        {agents.loading && <LoadingState label="LOADING AGENTS" />}
        {agents.error && <ErrorState message={agents.error} onRetry={agents.reload} />}

        {!agents.loading && !agents.error && comparable.length === 0 && (
          <div className="mt-10">
            <EmptyState
              title="NOTHING TO COMPARE YET"
              hint="An agent needs at least two evaluated versions before a regression diff is possible. Run a second evaluation on any agent."
            />
          </div>
        )}

        {agent && left && right && (
          <>
            {comparable.length > 1 && (
              <ScrollReveal className="mt-8">
                <div className="border border-bone-600/20 bg-ink-900/60 p-5">
                  <SystemLabel className="text-bone-600">AGENT</SystemLabel>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comparable.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setParams({ agent: a.id })}
                        className={`border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                          a.id === agent.id
                            ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                            : 'border-bone-600/30 text-bone-500 hover:text-bone-200'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            )}

            <ScrollReveal className="mt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="border border-bone-600/20 bg-ink-900/60 p-5">
                  <SystemLabel className="text-bone-600">BASELINE VERSION</SystemLabel>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agent.versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setLeftId(v.id)}
                        disabled={v.id === rightId}
                        className={`border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-30 ${
                          v.id === leftId
                            ? 'border-bone-400 bg-bone-600/20 text-bone-100'
                            : 'border-bone-600/30 text-bone-500 hover:text-bone-200'
                        }`}
                      >
                        {v.version}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border border-violet-500/20 bg-violet-500/5 p-5">
                  <SystemLabel className="text-violet-400">COMPARING AGAINST</SystemLabel>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {agent.versions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setRightId(v.id)}
                        disabled={v.id === leftId}
                        className={`border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-30 ${
                          v.id === rightId
                            ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                            : 'border-bone-600/30 text-bone-500 hover:text-bone-200'
                        }`}
                      >
                        {v.version}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <div className="mt-12">
              <VersionBattle
                left={left}
                right={right}
                diff={diff.data}
                diffError={diff.error}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
