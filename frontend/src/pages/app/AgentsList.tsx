import { Link } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
import { AgentModule } from '@/components/AgentModule';
import { SystemLabel } from '@/components/SystemLabel';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

export default function AgentsList() {
  const { data: agents, error, loading, reload } = useResource(() => api.agents(), []);

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SystemLabel>AGENTS / REGISTERED</SystemLabel>
            <h1 className="massive mt-2 text-[clamp(2rem,5vw,3.5rem)] text-bone-50">ALL AGENTS.</h1>
          </div>
          <Link
            to="/app/agents/new"
            className="group flex items-center gap-2 border border-violet-500/40 bg-violet-500/10 px-6 py-3 font-mono text-xs uppercase tracking-wider text-violet-400 transition-colors hover:bg-violet-500/20"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">INITIALIZE NEW AGENT</span>
            <span className="sm:hidden">NEW</span>
          </Link>
        </div>

        <div className="mt-10">
          {loading && <LoadingState label="LOADING AGENTS" />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {agents && agents.length === 0 && (
            <EmptyState
              title="NO AGENTS REGISTERED"
              hint="Register an agent with its system prompt and tools, and Aegis will generate a scenario suite for it."
              action={
                <Link
                  to="/app/agents/new"
                  className="mt-2 border border-violet-500/40 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:bg-violet-500/10"
                >
                  INITIALIZE NEW AGENT
                </Link>
              }
            />
          )}
          {agents && agents.length > 0 && (
            <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent, i) => (
                <AgentModule key={agent.id} agent={agent} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
