import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/AsyncState';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Workspace } from '@/types';

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Workspace['role'][];
}) {
  const auth = useAuth();
  const workspace = useWorkspace();
  const location = useLocation();

  if (auth.loading || (auth.user && workspace.loading)) {
    return (
      <div className="min-h-screen bg-ink-950 px-6 py-20">
        <LoadingState label="OPENING WORKSPACE" />
      </div>
    );
  }
  if (!auth.user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }
  if (workspace.error) {
    return (
      <div className="min-h-screen bg-ink-950 px-6 py-20 text-center">
        <p className="text-sm text-fault-400">{workspace.error}</p>
        <button
          type="button"
          onClick={() => void workspace.refresh()}
          className="mt-6 border border-signal-500/40 px-5 py-3 font-mono text-xs text-signal-300"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }
  if (!workspace.current) {
    return (
      <div className="min-h-screen bg-ink-950 px-6 py-20">
        <LoadingState label="CREATING WORKSPACE" />
      </div>
    );
  }
  if (roles && !roles.includes(workspace.current.role)) {
    return <Navigate to="/app" replace />;
  }
  return children;
}
