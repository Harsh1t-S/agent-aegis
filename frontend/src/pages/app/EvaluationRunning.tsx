import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppNavigation } from '@/components/AppNavigation';
import { EvaluationProgress } from '@/components/EvaluationProgress';
import { LiveActivityStream } from '@/components/LiveActivityStream';
import { MassiveHeading } from '@/components/MassiveHeading';
import { SystemLabel } from '@/components/SystemLabel';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { Loader2, Square } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function EvaluationRunning() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data, error, loading, reload } = useResource(
    () => api.progress(id as string),
    [id],
    { enabled: Boolean(id), pollMs: 1500,
      pollWhile: (run) => run.canContinue !== false && run.status === 'running' },
  );

  const done = data?.status === 'completed' || data?.status === 'failed' || data?.status === 'canceled';
  const failed = data?.status === 'failed';
  const canceled = data?.status === 'canceled';

  useEffect(() => {
    if (!done) return;
    // Let the last bar animation land before swapping screens.
    const timer = setTimeout(() => navigate(`/app/evaluations/${id}`), 900);
    return () => clearTimeout(timer);
  }, [done, id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <LoadingState label="ATTACHING TO RUN" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <div className="px-6 py-16 md:px-10">
          <ErrorState message={error ?? 'Evaluation not found.'} onRetry={reload} />
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

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-bone-500">
          <Link to="/app/agents" className="hover:text-bone-200">
            {data.agentName.toUpperCase() || 'AGENTS'}
          </Link>
          <span>/</span>
          <span className="text-signal-400">
            {failed ? 'EVALUATION ENDED WITH ERRORS' : canceled ? 'EVALUATION CANCELED' : done ? 'EVALUATION COMPLETE' : 'EVALUATION IN PROGRESS'}
          </span>
        </div>

        <MassiveHeading
          lines={failed ? ['EVALUATION', 'EXECUTION ERROR.'] : canceled ? ['EVALUATION', 'CANCELED.'] : done ? ['EVALUATION', 'COMPLETE.'] : ['EVALUATION', 'IN PROGRESS.']}
          className="mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50"
        />

        {!done && data.canContinue === false && <p className="mt-6 border border-warn-500/40 p-4 text-sm text-warn-400">
          The evaluation worker is not available. Your queued scenarios are safe; an administrator should restart the worker and this page will update automatically.
        </p>}
        <div className="mt-12 grid min-w-0 gap-6 lg:grid-cols-2">
          <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <motion.div
                className={`h-3 w-3 rounded-full ${done ? 'bg-flux-500' : 'bg-signal-500'}`}
                animate={done ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
                transition={done ? undefined : { duration: 1, repeat: Infinity }}
              />
              <SystemLabel className={done ? 'text-flux-400' : 'text-signal-400'}>
                {done ? 'DONE' : 'LIVE'}
              </SystemLabel>
            </div>

            <div className="mt-8">
              <EvaluationProgress
                complete={data.completed}
                total={data.total}
                status={data.status}
              />
            </div>

            {done && (
              <Link
                to={`/app/evaluations/${id}`}
                className="mt-8 inline-block border border-signal-500/40 bg-signal-500/10 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-signal-400 hover:bg-signal-500/20"
              >
                VIEW REPORT →
              </Link>
            )}
            {!done && workspace.current?.role !== 'viewer' && (
              <button type="button" disabled={canceling}
                onClick={async () => {
                  setCanceling(true);
                  setCancelError(null);
                  try {
                    await api.cancelEvaluation(id as string);
                    await reload();
                  } catch (cause) {
                    setCancelError(cause instanceof Error ? cause.message : 'The evaluation could not be canceled.');
                  } finally {
                    setCanceling(false);
                  }
                }}
                className="mt-8 flex min-h-11 items-center gap-2 border border-bone-600/30 px-4 font-mono text-[11px] uppercase tracking-wider text-bone-400 hover:border-fault-500/50 hover:text-fault-400 disabled:opacity-50">
                {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                CANCEL EVALUATION
              </button>
            )}
            {cancelError && <p role="alert" className="mt-3 text-xs text-fault-400">{cancelError}</p>}
          </div>

          <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>ACTIVITY LOG</SystemLabel>
            <div className="mt-4">
              <LiveActivityStream events={data.events} />
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-bone-600">
              Reported by the evaluation API, most recent last.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px border border-bone-600/20 bg-bone-600/20 md:grid-cols-4">
          {[
            { label: 'AGENT', value: data.agentName || '—' },
            { label: 'VERSION', value: data.version },
            { label: 'SCENARIOS', value: String(data.total) },
            { label: 'COMPLETED', value: `${data.completed} / ${data.total}` },
          ].map((item) => (
            <div key={item.label} className="bg-ink-900/80 p-4">
              <SystemLabel className="text-bone-600">{item.label}</SystemLabel>
              <div className="mt-1 truncate font-mono text-sm text-bone-100">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
