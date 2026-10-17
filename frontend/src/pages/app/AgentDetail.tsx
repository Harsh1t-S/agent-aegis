import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { NextSteps, PageHeader } from '@/components/PageHeader';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { MetricLine } from '@/components/MetricLine';
import { VersionEvolution } from '@/components/VersionEvolution';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { METRIC_COLORS } from '@/lib/palette';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toaster';
import { agentStatusLabel, agentStatusTone, evaluationPath, formatDate, hasAgentScore } from '@/lib/format';
import { Play, ArrowRight, Clock, GitCompareArrows, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buttonDanger, buttonPrimary, buttonSecondary, card, sectionTitle } from '@/lib/ui';

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const toast = useToast();
  const { data: agent, error, loading, reload } = useResource(
    () => api.agent(id as string),
    [id],
    { enabled: Boolean(id) },
  );
  const [startError, setStartError] = useState<string | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canMutate = workspace.current?.role !== 'viewer';

  const remove = async () => {
    if (!agent) return;
    setDeleting(true);
    setStartError(undefined);
    try {
      await api.deleteAgent(agent.id);
      toast.success(`${agent.name} deleted`);
      navigate('/app/agents');
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Could not delete the agent.');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <LoadingState label="Loading agent" />
    );
  }

  if (error || !agent) {
    return (
      <div className="py-8">
        <ErrorState message={error ?? 'Agent not found.'} onRetry={reload} />
        <div className="mt-6 text-center">
          <Link to="/app/agents" className={buttonSecondary}>Back to agents</Link>
        </div>
      </div>
    );
  }

  const latestVersion = agent.versions[agent.versions.length - 1];
  const hasRun = hasAgentScore(agent) && Boolean(latestVersion);
  const nextSteps = [
    ...(latestVersion
      ? [{ to: evaluationPath(latestVersion), label: 'Read the latest report', hint: `${latestVersion.version} · ${formatDate(latestVersion.createdAt)}` }]
      : []),
    ...(agent.versions.length > 1
      ? [{ to: `/app/compare?agent=${agent.id}`, label: 'Compare versions', hint: 'See what changed between two runs.' }]
      : []),
    ...(canMutate
      ? [{ to: `/app/agents/${agent.id}/review`, label: hasRun ? 'Run it again' : 'Review the suite and run it', hint: 'Check the scenarios, then start an evaluation.' }]
      : []),
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Agents', to: '/app/agents' }, { label: agent.name }]}
        meta={(
          <>
            <span className="text-sm text-bone-300">{agent.domain}</span>
            <span className={`text-sm font-medium capitalize ${agentStatusTone[agent.status]}`}>
              {agentStatusLabel[agent.status]}
            </span>
          </>
        )}
        title={agent.name}
        description={agent.description}
        actions={canMutate && (
          <>
            <Link to={`/app/agents/${agent.id}/edit`} className={buttonSecondary}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Link>
            {agent.versions.length > 1 && (
              <Link to={`/app/compare?agent=${agent.id}`} className={buttonSecondary}>
                <GitCompareArrows className="h-4 w-4" aria-hidden /> Compare
              </Link>
            )}
            <Link to={`/app/agents/${agent.id}/review`} className={buttonPrimary}>
              <Play className="h-4 w-4" aria-hidden /> Review & run
            </Link>
          </>
        )}
      />
      {startError && <p role="alert" className="mb-6 border border-fault-500/40 bg-fault-500/5 px-4 py-3 text-sm text-fault-300">{startError}</p>}

      <div className="space-y-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <section className={`${card} flex min-w-0 flex-col items-center justify-center text-center lg:col-span-1`}>
            {hasRun ? (
              <>
                <ReliabilityScore score={agent.reliability} size="md" />
                <p className="mt-4 flex items-center gap-2 text-sm text-bone-300">
                  <Clock className="h-4 w-4" aria-hidden /> {formatDate(agent.lastEvaluated)}
                </p>
              </>
            ) : (
              <div className="py-6">
                <p className="font-mono text-5xl text-bone-300">—</p>
                <p className="mt-3 text-sm font-medium capitalize text-bone-200">{agentStatusLabel[agent.status]}</p>
                <p className="mx-auto mt-2 max-w-xs text-sm text-bone-300">
                  {latestVersion ? 'Open the latest run to follow progress or inspect its error.' : 'Run an evaluation to see this agent’s reliability score.'}
                </p>
              </div>
            )}
          </section>

          <section className={`${card} min-w-0 lg:col-span-2`}>
            <h2 className={sectionTitle}>Reliability dimensions</h2>
            {hasRun ? (
              <>
                <div className="mt-5 grid gap-5">
                  <MetricLine label="Task success" value={latestVersion.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
                  <MetricLine label="Tool accuracy" value={latestVersion.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} />
                  <MetricLine label="Safety" value={latestVersion.metrics.safety} color={METRIC_COLORS.safety} />
                  <MetricLine label="Loop resistance" value={latestVersion.metrics.consistency} color={METRIC_COLORS.consistency} />
                  <MetricLine label="Groundedness" value={latestVersion.metrics.groundedness} color={METRIC_COLORS.groundedness} />
                </div>

                <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-bone-600/25 pt-5 text-center">
                  <div>
                    <dd className="font-mono text-2xl font-semibold text-bone-50">{agent.versions.length}</dd>
                    <dt className="mt-1 text-sm text-bone-300">Versions</dt>
                  </div>
                  <div>
                    <dd className="font-mono text-2xl font-semibold text-flux-400">{latestVersion.passRate.toFixed(1)}%</dd>
                    <dt className="mt-1 text-sm text-bone-300">Pass rate</dt>
                  </div>
                  <div>
                    <dd className="font-mono text-2xl font-semibold text-fault-400">
                      {Object.values(latestVersion.failures ?? {}).reduce((a, b) => a + b, 0)}
                    </dd>
                    <dt className="mt-1 text-sm text-bone-300">Findings</dt>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-4 text-sm text-bone-300">
                Dimensions are measured from scenario runs. Run an evaluation to populate them.
              </p>
            )}
          </section>
        </div>

        <section className={card}>
          <h2 className={sectionTitle}>Available tools ({agent.tools.length})</h2>
          <ul className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {agent.tools.map((tool) => (
              <li key={tool.id} className="min-w-0 border border-bone-600/30 bg-ink-850/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm text-signal-300">{tool.name}</span>
                  <span
                    className={`shrink-0 border px-2 py-0.5 text-sm ${
                      tool.risk === 'high'
                        ? 'border-fault-500/50 text-fault-400'
                        : tool.risk === 'medium'
                          ? 'border-warn-500/50 text-warn-400'
                          : 'border-flux-500/50 text-flux-400'
                    }`}
                  >
                    {tool.risk}
                  </span>
                </div>
                <p className="mt-2 text-sm text-bone-300">{tool.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <h2 className={sectionTitle}>System prompt</h2>
          <pre className="mt-4 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-bone-200">
            {agent.systemPrompt}
          </pre>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionTitle}>Version history</h2>
            {agent.versions.length > 1 && (
              <Link
                to={`/app/compare?agent=${agent.id}`}
                className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-signal-300 hover:text-signal-400"
              >
                Compare versions <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            )}
          </div>
          <div className="mt-5">
            <VersionEvolution versions={agent.versions} />
          </div>
        </section>
      </div>

      <NextSteps steps={nextSteps} />

      {canMutate && (
        <section className="mt-10 border-t border-bone-600/20 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-medium text-bone-100">Delete agent</h2>
              <p className="mt-1 max-w-lg text-sm text-bone-300">
                Removes the agent and every run recorded against it. This cannot be undone.
              </p>
            </div>
            {confirmingDelete ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className={buttonSecondary}>
                  Cancel
                </button>
                <button type="button" onClick={remove} disabled={deleting} className={buttonDanger}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                  Delete permanently
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} className={buttonDanger}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
