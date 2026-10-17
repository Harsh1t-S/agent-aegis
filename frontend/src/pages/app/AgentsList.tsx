import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AgentModule } from '@/components/AgentModule';
import { EmptyState, ErrorState, LoadingState } from '@/components/AsyncState';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buttonPrimary, buttonSecondary } from '@/lib/ui';

const PAGE_SIZE = 24;

export default function AgentsList() {
  const workspace = useWorkspace();
  const [page, setPage] = useState(0);
  const { data: agents, error, loading, reload } = useResource(
    () => api.agents(PAGE_SIZE, page * PAGE_SIZE),
    [workspace.current?.id, page],
  );
  const canCreate = workspace.current?.role !== 'viewer';

  useEffect(() => setPage(0), [workspace.current?.id]);

  return (
    <>
        <PageHeader
          crumbs={[{ label: 'Testing' }, { label: 'Agents' }]}
          title="Agents"
          description="Every agent registered in this workspace. Open one to edit it, run an evaluation or read its history."
          actions={canCreate && (
            <Link to="/app/agents/new" className={buttonPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> New agent
            </Link>
          )}
        />

        <div className="mt-8">
          {loading && <LoadingState label="Loading agents" />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {agents && agents.length === 0 && (
            <EmptyState
              title="No agents registered"
              hint="Register an agent with its system prompt and tools, and Aegis will generate a scenario suite for it."
              action={
                canCreate ? <Link
                  to="/app/agents/new"
                  className={`${buttonPrimary} mt-2`}
                >
                  <Plus className="h-4 w-4" aria-hidden /> New agent
                </Link> : undefined
              }
            />
          )}
          {agents && agents.length > 0 && (
            <>
              <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {agents.map((agent) => (
                  <AgentModule key={agent.id} agent={agent} />
                ))}
              </div>
              {(page > 0 || agents.length === PAGE_SIZE) && (
                <div className="mt-8 flex items-center justify-between border-t border-bone-600/20 pt-5">
                  <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}
                    className={buttonSecondary}>Newer</button>
                  <span className="text-sm text-bone-300">Page {page + 1}</span>
                  <button type="button" disabled={agents.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}
                    className={buttonSecondary}>Older</button>
                </div>
              )}
            </>
          )}
        </div>
    </>
  );
}
