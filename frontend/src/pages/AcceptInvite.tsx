import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { buttonPrimary, buttonSecondary } from '@/lib/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { api, ApiError } from '@/lib/api';

export default function AcceptInvite() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = params.get('token');

  if (!auth.loading && !auth.user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  const accept = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.acceptInvite(token);
      // select() from this render still holds the pre-refresh membership list,
      // so the joined workspace is chosen inside the reload itself.
      await workspace.refresh(result.workspaceId ?? undefined);
      navigate('/app', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not accept this invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Team invitation' }]}
        title="Join the workspace"
        description="Accepting gives your signed-in account access at the role chosen by the workspace owner."
        actions={(
          <>
            <Link to="/app" className={buttonSecondary}>Not now</Link>
            <button type="button" disabled={!token || busy} onClick={() => void accept()} className={buttonPrimary}>
              {busy ? 'Accepting…' : 'Accept invitation'}
            </button>
          </>
        )}
      />
      {!token && <p role="alert" className="border border-fault-500/50 bg-fault-500/5 p-4 text-sm text-fault-300">This invitation link is incomplete. Ask the workspace owner to send it again.</p>}
      {error && <p role="alert" className="mt-4 border border-fault-500/50 bg-fault-500/5 p-4 text-sm text-fault-300">{error}</p>}
    </>
  );
}
