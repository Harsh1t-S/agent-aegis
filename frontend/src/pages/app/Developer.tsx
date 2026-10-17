import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Download, KeyRound, Trash2 } from 'lucide-react';
import { buttonPrimary, buttonSecondary } from '@/lib/ui';
import { PageHeader } from '@/components/PageHeader';
import { AsyncBoundary } from '@/components/AsyncState';
import { SystemLabel } from '@/components/SystemLabel';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function Developer() {
  const workspace = useWorkspace();
  const keys = useResource(() => api.apiKeys(), [workspace.current?.id]);
  const [auditCursor, setAuditCursor] = useState<string | undefined>();
  const [auditHistory, setAuditHistory] = useState<Array<string | undefined>>([]);
  const events = useResource(
    () => api.audit(auditCursor),
    [workspace.current?.id, auditCursor],
  );
  const toast = useToast();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Array<'read' | 'evaluate' | 'admin'>>(['read', 'evaluate']);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(90);
  const [secret, setSecret] = useState<string | null>(null);
  const canManage = workspace.current?.role === 'owner' || workspace.current?.role === 'admin';

  useEffect(() => {
    setAuditCursor(undefined);
    setAuditHistory([]);
  }, [workspace.current?.id]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (scopes.length === 0) {
      toast.error('Choose at least one scope');
      return;
    }
    try {
      const result = await api.createApiKey(name.trim(), scopes, expiresInDays);
      setSecret(result.key);
      setName('');
      keys.reload();
    } catch (cause) {
      toast.error('Could not create key', cause instanceof ApiError ? cause.message : 'Try again.');
    }
  };

  const exportBenchmark = async () => {
    try {
      const payload = await api.reviewedBenchmark();
      const url = URL.createObjectURL(new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: 'application/json' },
      ));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `aegis-reviewed-benchmark-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Benchmark exported', `${payload.records.length} reviewed runs included.`);
    } catch (cause) {
      toast.error('Benchmark not exported', cause instanceof ApiError ? cause.message : 'Try again.');
    }
  };

  return (
    <>
        <PageHeader
          crumbs={[{ label: 'Workspace' }, { label: 'API & audit' }]}
          title="API & audit"
          description="Named keys belong to this workspace. The raw secret is shown once and only its hash is stored."
        />

        {canManage && (
          <form onSubmit={create} className="mt-8 grid max-w-3xl gap-4 border border-bone-600/30 bg-ink-900 p-4 sm:p-6 sm:grid-cols-[1fr_180px_auto]">
            <label htmlFor="key-name" className="sr-only">API key name</label>
            <input id="key-name" required value={name} onChange={(event) => setName(event.target.value)}
              placeholder="CI release gate"
              className="min-h-11 flex-1 border border-bone-600/35 bg-ink-950 px-4 text-sm text-bone-50 outline-none focus:border-signal-400" />
            <label className="sr-only" htmlFor="key-expiry">API key expiry</label>
            <select id="key-expiry" value={expiresInDays ?? ''}
              onChange={(event) => setExpiresInDays(event.target.value ? Number(event.target.value) : undefined)}
              className="min-h-11 border border-bone-600/35 bg-ink-950 px-3 font-mono text-xs text-bone-200">
              <option value="30">Expires in 30 days</option>
              <option value="90">Expires in 90 days</option>
              <option value="365">Expires in 1 year</option>
              <option value="">No expiry</option>
            </select>
            <button type="submit"
              className={buttonPrimary}>
              <KeyRound className="h-4 w-4" />Create key
            </button>
            <fieldset className="flex flex-wrap gap-4 sm:col-span-3">
              <legend className="mb-2 font-mono text-xs tracking-wider text-bone-500">Least-privilege scopes</legend>
              {(['read', 'evaluate', 'admin'] as const).map((scope) => (
                <label key={scope} className="flex min-h-9 cursor-pointer items-center gap-2 font-mono text-sm text-bone-300">
                  <input type="checkbox" checked={scopes.includes(scope)}
                    onChange={(event) => setScopes((current) => event.target.checked
                      ? [...new Set([...current, scope])]
                      : current.filter((item) => item !== scope))}
                    className="h-4 w-4 accent-signal-500" />
                  {scope}
                </label>
              ))}
              <p className="basis-full text-sm text-bone-300">Read inspects reports, evaluate starts or reruns tests, and admin changes workspace configuration.</p>
            </fieldset>
          </form>
        )}

        {secret && (
          <div className="mt-4 max-w-2xl border border-warn-500/35 bg-warn-500/5 p-5">
            <SystemLabel className="text-warn-400">Copy this key now</SystemLabel>
            <code className="mt-3 block break-all text-xs text-bone-100">{secret}</code>
            <button type="button" onClick={() => {
              void navigator.clipboard.writeText(secret);
              toast.success('Copied', 'The API key is on your clipboard.');
            }} className="mt-4 flex min-h-10 items-center gap-2 border border-warn-500/30 px-4 font-mono text-xs text-warn-300">
              <Copy className="h-3.5 w-3.5" />Copy key
            </button>
          </div>
        )}

        <section className="mt-8 max-w-4xl border border-bone-600/30 bg-ink-900 p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-bone-50">Workspace keys</h2>
          <AsyncBoundary loading={keys.loading} error={keys.error} onRetry={keys.reload} label="Loading keys">
            <div className="mt-4 divide-y divide-bone-600/15">
              {(keys.data ?? []).map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm text-bone-100">{key.name}</p>
                    <p className="mt-1 font-mono text-sm text-bone-300">
                      {key.prefix}… · {key.scopes.join(', ')}
                      {key.revoked && <span className="text-fault-400"> · revoked</span>}
                    </p>
                  </div>
                  {!key.revoked && canManage && (
                    <button type="button" aria-label={`Revoke ${key.name}`} onClick={async () => {
                      await api.revokeApiKey(key.id);
                      keys.reload();
                    }} className="flex h-10 w-10 items-center justify-center text-bone-500 hover:text-fault-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {keys.data?.length === 0 && <p className="py-6 text-sm text-bone-300">No API keys yet.</p>}
            </div>
          </AsyncBoundary>
        </section>

        <section className="mt-8 max-w-4xl border border-bone-600/30 bg-ink-900 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SystemLabel>Audit trail</SystemLabel>
            {canManage && (
              <button type="button" onClick={() => void exportBenchmark()}
                className={buttonSecondary}>
                <Download className="h-3.5 w-3.5" />Export reviewed benchmark
              </button>
            )}
          </div>
          <AsyncBoundary loading={events.loading} error={events.error} onRetry={events.reload} label="Loading audit">
            <div className="mt-4 divide-y divide-bone-600/15">
              {(events.data?.items ?? []).map((event) => (
                <div key={event.id} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto]">
                  <p className="font-mono text-sm text-bone-200">{event.action}</p>
                  <time className="font-mono text-xs text-bone-400">{new Date(event.createdAt).toLocaleString()}</time>
                  <p className="text-sm text-bone-300">{event.targetType} {event.targetId}</p>
                </div>
              ))}
              {events.data?.items.length === 0 && <p className="py-6 text-sm text-bone-300">No activity recorded yet.</p>}
            </div>
            {(auditHistory.length > 0 || events.data?.nextCursor) && (
              <div className="mt-4 flex items-center justify-between border-t border-bone-600/15 pt-4">
                <button type="button" disabled={auditHistory.length === 0}
                  onClick={() => {
                    const previous = auditHistory[auditHistory.length - 1];
                    setAuditHistory((current) => current.slice(0, -1));
                    setAuditCursor(previous);
                  }}
                  className="min-h-10 px-3 font-mono text-xs text-bone-400 disabled:opacity-30">Previous
                </button>
                <button type="button" disabled={!events.data?.nextCursor}
                  onClick={() => {
                    setAuditHistory((current) => [...current, auditCursor]);
                    setAuditCursor(events.data?.nextCursor ?? undefined);
                  }}
                  className="min-h-10 px-3 font-mono text-xs text-bone-400 disabled:opacity-30">Older events
                </button>
              </div>
            )}
          </AsyncBoundary>
        </section>
    </>
  );
}
