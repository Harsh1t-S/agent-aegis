import { useState } from 'react';
import { api } from '@/lib/api';
import { setOwnerKey } from '@/lib/owner-access';
import { useResource } from '@/hooks/useResource';
import { ErrorState, LoadingState } from './AsyncState';
import { SystemLabel } from './SystemLabel';

export function OwnerAccess({ onUnlocked }: { onUnlocked?: () => void }) {
  const access = useResource(() => api.access(), []);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.access(key.trim());
      if (!result.authorized) {
        if (!result.configured) throw new Error('Owner access has not been configured on the server.');
        if (result.keyReceived === false) throw new Error('Your owner key did not reach the API. Refresh this page and try again.');
        throw new Error('That owner access key is not valid for this API. Check the Production value of AEGIS_ADMIN_KEY on aegis-api, and redeploy the API if you changed it.');
      }
      setOwnerKey(key.trim());
      setKey('');
      access.reload();
      onUnlocked?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock actions.');
    } finally { setBusy(false); }
  };

  return <section className="mt-8 max-w-2xl border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
    <SystemLabel>OWNER ACCESS</SystemLabel>
    <p className="mt-3 text-sm text-bone-300">Saved reports are public. Editing agents and running evaluations require owner access.</p>
    {access.loading ? <LoadingState label="CHECKING ACCESS" /> : access.error ?
      <ErrorState message={access.error} onRetry={access.reload} /> : access.data?.authorized ? <>
        <p role="status" className="mt-4 text-sm text-flux-400">{access.data.required ? 'Actions unlocked in this tab.' : 'Local development: actions are enabled.'}</p>
        {access.data.required && <button type="button" onClick={() => { setOwnerKey(''); access.reload(); }}
          className="mt-4 min-h-11 border border-bone-600/35 px-4 font-mono text-xs text-bone-100">LOCK ACTIONS</button>}
      </> : <form onSubmit={unlock} className="mt-4 space-y-3">
        {!access.data?.configured && <p className="text-sm text-warn-400">Set AEGIS_ADMIN_KEY in the backend’s Vercel environment variables, then redeploy.</p>}
        <label htmlFor="owner-access-key" className="block font-mono text-xs text-bone-300">Owner access key</label>
        <input id="owner-access-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)}
          className="w-full border border-bone-300/35 bg-ink-950 px-4 py-3 text-base text-bone-50" />
        <p className="text-xs text-bone-400">Paste only the value of AEGIS_ADMIN_KEY from aegis-api’s Production environment. Leave out AEGIS_ADMIN_KEY= and any surrounding quotes. Your AIRouter key belongs in AIROUTER_API_KEY on the server.</p>
        {error && <p role="alert" className="text-sm text-fault-400">{error}</p>}
        <button type="submit" disabled={busy || !key.trim() || !access.data?.configured}
          className="min-h-11 border border-signal-500/40 px-4 font-mono text-xs text-signal-300 disabled:opacity-50">
          {busy ? 'CHECKING…' : 'UNLOCK ACTIONS'}
        </button>
      </form>}
  </section>;
}
