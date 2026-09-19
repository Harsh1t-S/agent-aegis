import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppNavigation } from '@/components/AppNavigation';
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
      await workspace.refresh();
      if (result.workspaceId) workspace.select(result.workspaceId);
      navigate('/app', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not accept this invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-signal-400">TEAM INVITATION</p>
        <h1 className="massive mt-4 text-5xl text-bone-50">JOIN THE WORKSPACE.</h1>
        <p className="mt-5 text-sm leading-relaxed text-bone-400">
          Accepting gives your signed-in account access at the role chosen by the workspace owner.
        </p>
        {!token && <p className="mt-6 text-fault-400">This invitation link is incomplete.</p>}
        {error && <p role="alert" className="mt-6 text-fault-400">{error}</p>}
        <button type="button" disabled={!token || busy} onClick={() => void accept()}
          className="mt-8 min-h-12 border border-signal-500/50 bg-signal-500/10 px-8 font-mono text-xs uppercase tracking-wider text-signal-300 disabled:opacity-50">
          {busy ? 'ACCEPTING…' : 'ACCEPT INVITATION'}
        </button>
      </main>
    </div>
  );
}
