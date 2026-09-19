import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { MetricLine } from '@/components/MetricLine';
import { VersionEvolution } from '@/components/VersionEvolution';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SystemLabel } from '@/components/SystemLabel';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { METRIC_COLORS } from '@/lib/palette';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toaster';
import { agentStatusLabel, agentStatusTone, evaluationPath, formatDate, hasAgentScore } from '@/lib/format';
import { Play, ArrowRight, Clock, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

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
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <LoadingState label="LOADING AGENT" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <div className="px-6 py-16 md:px-10">
          <ErrorState message={error ?? 'Agent not found.'} onRetry={reload} />
          <div className="mt-6 text-center">
            <Link
              to="/app/agents"
              className="border border-signal-500/40 px-6 py-3 font-mono text-xs uppercase tracking-wider text-signal-400 hover:bg-signal-500/10"
            >
              BACK TO AGENTS
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const latestVersion = agent.versions[agent.versions.length - 1];
  const hasRun = hasAgentScore(agent) && Boolean(latestVersion);

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-bone-500">
          <Link to="/app/agents" className="inline-flex min-h-9 items-center hover:text-bone-200">
            AGENTS
          </Link>
          <span>/</span>
          <span className="text-signal-400">{agent.name.toUpperCase()}</span>
        </div>

        <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <SystemLabel>{agent.domain.toUpperCase()}</SystemLabel>
              <span className={`tech-label ${agentStatusTone[agent.status]}`}>
                {agentStatusLabel[agent.status]}
              </span>
            </div>
            <h1 className="massive mt-2 text-[clamp(2rem,5vw,3.5rem)] text-bone-50">{agent.name}</h1>
            <p className="mt-2 max-w-lg text-sm text-bone-400">{agent.description}</p>
          </div>
          {canMutate && <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/app/agents/${agent.id}/edit`}
              className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-4 font-mono text-xs uppercase tracking-wider text-bone-300 transition-colors hover:border-signal-400/50 hover:text-signal-300"
            >
              <Pencil className="h-3.5 w-3.5" /> EDIT
            </Link>
            <Link
              to={`/app/agents/${agent.id}/review`}
              className="group flex min-h-11 items-center gap-2 border border-signal-500/40 bg-signal-500/10 px-6 py-3 font-mono text-xs uppercase tracking-wider text-signal-400 transition-colors hover:bg-signal-500/20"
            >
              <Play className="h-4 w-4" /> REVIEW & RUN
            </Link>
            </div>
            {startError && <span className="font-mono text-[11px] text-fault-400">{startError}</span>}
          </div>}
        </div>

        <div className="mt-12 grid min-w-0 gap-6 lg:grid-cols-3">
          <ScrollReveal className="min-w-0 lg:col-span-1">
            <div className="flex min-h-[240px] min-w-0 flex-col items-center justify-center border border-bone-600/20 bg-ink-900/60 p-5 sm:min-h-[320px] sm:p-8">
              {hasRun ? (
                <>
                  <ReliabilityScore score={agent.reliability} size="lg" />
                  <div className="mt-6 flex items-center gap-2">
                    <Clock className="h-3 w-3 text-bone-600" />
                    <SystemLabel className="text-bone-600">
                      {formatDate(agent.lastEvaluated)}
                    </SystemLabel>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="massive text-6xl text-bone-600">—</div>
                  <SystemLabel className="mt-4 block text-bone-500">{agentStatusLabel[agent.status]}</SystemLabel>
                  <p className="mt-3 max-w-[16rem] text-sm text-bone-400">
                    {latestVersion ? 'Open the latest evaluation to follow progress or inspect its execution error.' : 'Run an evaluation to see this agent’s reliability score.'}
                  </p>
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="min-w-0 lg:col-span-2">
            <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-8">
              <SystemLabel>RELIABILITY DIMENSIONS</SystemLabel>
              {hasRun ? (
                <>
                  <div className="mt-6 grid gap-6">
                    <MetricLine label="TASK SUCCESS" value={latestVersion.metrics.taskSuccess} color={METRIC_COLORS.taskSuccess} />
                    <MetricLine label="TOOL ACCURACY" value={latestVersion.metrics.toolAccuracy} color={METRIC_COLORS.toolAccuracy} delay={0.1} />
                    <MetricLine label="SAFETY" value={latestVersion.metrics.safety} color={METRIC_COLORS.safety} delay={0.15} />
                    <MetricLine label="LOOP RESISTANCE" value={latestVersion.metrics.consistency} color={METRIC_COLORS.consistency} delay={0.2} />
                    <MetricLine label="GROUNDEDNESS" value={latestVersion.metrics.groundedness} color={METRIC_COLORS.groundedness} delay={0.25} />
                  </div>

                  <div className="mt-8 grid grid-cols-3 gap-px border-t border-bone-600/20 pt-6">
                    <div className="text-center">
                      <div className="font-mono text-2xl font-bold text-bone-50">
                        {agent.versions.length}
                      </div>
                      <SystemLabel className="mt-1 block">VERSIONS</SystemLabel>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-2xl font-bold text-flux-400">
                        {latestVersion.passRate.toFixed(1)}%
                      </div>
                      <SystemLabel className="mt-1 block">PASS RATE</SystemLabel>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-2xl font-bold text-fault-400">
                        {Object.values(latestVersion.failures ?? {}).reduce((a, b) => a + b, 0)}
                      </div>
                      <SystemLabel className="mt-1 block">FINDINGS</SystemLabel>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-6 text-sm text-bone-400">
                  Dimensions are measured from scenario runs. Run an evaluation to populate them.
                </p>
              )}
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-6">
          <div className="border border-bone-600/20 bg-ink-900/60 p-6">
            <SystemLabel>AVAILABLE TOOLS — {agent.tools.length}</SystemLabel>
            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
              {agent.tools.map((tool) => (
                <div key={tool.id} className="min-w-0 border border-bone-600/20 bg-ink-850/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-sm text-signal-400">{tool.name}</span>
                    <span
                      className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        tool.risk === 'high'
                          ? 'border-fault-500/40 text-fault-400'
                          : tool.risk === 'medium'
                            ? 'border-warn-500/40 text-warn-400'
                            : 'border-flux-500/40 text-flux-400'
                      }`}
                    >
                      {tool.risk}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-bone-400">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="mt-6">
          <div className="border border-bone-600/20 bg-ink-900/60 p-6">
            <SystemLabel>SYSTEM PROMPT</SystemLabel>
            <pre className="mt-4 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-bone-200">
              {agent.systemPrompt}
            </pre>
          </div>
        </ScrollReveal>

        <ScrollReveal className="mt-6">
          <div className="border border-bone-600/20 bg-ink-900/60 p-6">
            <div className="flex items-center justify-between">
              <SystemLabel>VERSION HISTORY</SystemLabel>
              {agent.versions.length > 1 && (
                <Link
                  to={`/app/compare?agent=${agent.id}`}
                  className="group flex min-h-11 items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-signal-400 hover:text-signal-300"
                >
                  COMPARE VERSIONS{' '}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
            <div className="mt-6">
              <VersionEvolution versions={agent.versions} />
            </div>
          </div>
        </ScrollReveal>

        {latestVersion && (
          <ScrollReveal className="mt-6">
            <Link
              to={evaluationPath(latestVersion)}
              className="group flex items-center justify-between gap-4 border border-signal-500/30 bg-signal-500/5 p-6 transition-colors hover:bg-signal-500/10"
            >
              <div>
                <SystemLabel className="text-signal-400">LATEST EVALUATION</SystemLabel>
                <div className="mt-1 text-sm text-bone-200">
                  {latestVersion.version} — {formatDate(latestVersion.createdAt)} —{' '}
                  {hasRun ? `reliability ${latestVersion.reliability.toFixed(1)}/100` : agentStatusLabel[agent.status]}
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-signal-400 transition-transform group-hover:translate-x-1" />
            </Link>
          </ScrollReveal>
        )}

        {canMutate && <ScrollReveal className="mt-10 border-t border-bone-600/20 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <SystemLabel className="text-bone-600">DELETE AGENT</SystemLabel>
              <p className="mt-1 max-w-lg text-xs text-bone-500">
                Removes the agent and every evaluation recorded against it. This cannot be
                undone.
              </p>
            </div>
            {confirmingDelete ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="flex min-h-11 items-center gap-2 border border-fault-500/50 bg-fault-500/10 px-4 font-mono text-[11px] uppercase tracking-wider text-fault-300 transition-colors enabled:hover:bg-fault-500/20 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  DELETE PERMANENTLY
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="min-h-11 px-2 font-mono text-[11px] uppercase tracking-wider text-bone-400 hover:text-bone-100"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex min-h-11 items-center gap-2 border border-bone-600/30 px-4 font-mono text-[11px] uppercase tracking-wider text-bone-400 transition-colors hover:border-fault-500/40 hover:text-fault-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> DELETE
              </button>
            )}
          </div>
        </ScrollReveal>}
      </div>
    </div>
  );
}
