import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Download, KeyRound, Trash2 } from 'lucide-react';
import { buttonPrimary, buttonSecondary, card, fieldHint, fieldInput, fieldLabel, sectionTitle } from '@/lib/ui';
import { PageHeader } from '@/components/PageHeader';
import { AsyncBoundary } from '@/components/AsyncState';
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
        actions={canManage && (
          <button type="button" className={buttonPrimary}
            onClick={() => {
              const field = document.getElementById('key-name');
              field?.scrollIntoView({ block: 'center' });
              field?.focus();
            }}>
            <KeyRound className="h-4 w-4" aria-hidden /> New API key
          </button>
        )}
      />

      <div className="space-y-6">
        {canManage && (
          <form onSubmit={create} className={card}>
            <h2 className={sectionTitle}>Create an API key</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_14rem_auto] md:items-end">
              <div>
                <label htmlFor="key-name" className={fieldLabel}>Key name</label>
                <input id="key-name" required value={name} onChange={(event) => setName(event.target.value)}
                  placeholder="CI release gate"
                  className={`${fieldInput} mt-2`} />
              </div>
              <div>
                <label htmlFor="key-expiry" className={fieldLabel}>Expiry</label>
                <select id="key-expiry" value={expiresInDays ?? ''}
                  onChange={(event) => setExpiresInDays(event.target.value ? Number(event.target.value) : undefined)}
                  className={`${fieldInput} mt-2`}>
                  <option value="30">Expires in 30 days</option>
                  <option value="90">Expires in 90 days</option>
                  <option value="365">Expires in 1 year</option>
                  <option value="">No expiry</option>
                </select>
              </div>
              <button type="submit" className={buttonSecondary}>
                <KeyRound className="h-4 w-4" aria-hidden /> Create key
              </button>
            </div>
            <fieldset className="mt-4">
              <legend className={fieldLabel}>Least-privilege scopes</legend>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {(['read', 'evaluate', 'admin'] as const).map((scope) => (
                  <label key={scope} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-bone-100">
                    <input type="checkbox" checked={scopes.includes(scope)}
                      onChange={(event) => setScopes((current) => event.target.checked
                        ? [...new Set([...current, scope])]
                        : current.filter((item) => item !== scope))}
                      className="h-4 w-4 accent-signal-500" />
                    {scope}
                  </label>
                ))}
              </div>
              <p className={fieldHint}>Read inspects reports, evaluate starts or reruns tests, and admin changes workspace configuration.</p>
            </fieldset>
          </form>
        )}

        {secret && (
          <div role="status" className="border border-warn-500/50 bg-warn-500/5 p-4 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-warn-300">Copy this key now</h2>
            <p className="mt-1 text-sm text-bone-200">It is shown once. Only its hash is stored.</p>
            <code className="mt-3 block break-all font-mono text-sm text-bone-50">{secret}</code>
            <button type="button" onClick={() => {
              void navigator.clipboard.writeText(secret);
              toast.success('Copied', 'The API key is on your clipboard.');
            }} className={`${buttonSecondary} mt-4`}>
              <Copy className="h-4 w-4" aria-hidden /> Copy key
            </button>
          </div>
        )}

        <section className={card}>
          <h2 className={sectionTitle}>Workspace keys</h2>
          <AsyncBoundary loading={keys.loading} error={keys.error} onRetry={keys.reload} label="Loading keys">
            <div className="mt-2 divide-y divide-bone-600/25">
              {(keys.data ?? []).map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-bone-50">{key.name}</p>
                    <p className="mt-1 break-words font-mono text-sm text-bone-300">
                      {key.prefix}… · {key.scopes.join(', ')}
                      {key.revoked && <span className="text-fault-400"> · revoked</span>}
                    </p>
                  </div>
                  {!key.revoked && canManage && (
                    <button type="button" aria-label={`Revoke ${key.name}`} onClick={async () => {
                      await api.revokeApiKey(key.id);
                      keys.reload();
                    }} className="flex h-11 w-11 shrink-0 items-center justify-center text-bone-300 hover:text-fault-400">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              {keys.data?.length === 0 && <p className="py-6 text-sm text-bone-300">No API keys yet.</p>}
            </div>
          </AsyncBoundary>
        </section>

        <section className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className={sectionTitle}>Audit trail</h2>
            {canManage && (
              <button type="button" onClick={() => void exportBenchmark()} className={buttonSecondary}>
                <Download className="h-4 w-4" aria-hidden /> Export reviewed benchmark
              </button>
            )}
          </div>
          <AsyncBoundary loading={events.loading} error={events.error} onRetry={events.reload} label="Loading audit">
            <div className="mt-2 divide-y divide-bone-600/25">
              {(events.data?.items ?? []).map((event) => (
                <div key={event.id} className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:gap-x-6">
                  <p className="break-words font-mono text-sm text-bone-50">{event.action}</p>
                  <time className="text-sm text-bone-300">{new Date(event.createdAt).toLocaleString()}</time>
                  <p className="break-all text-sm text-bone-300">{event.targetType} {event.targetId}</p>
                </div>
              ))}
              {events.data?.items.length === 0 && <p className="py-6 text-sm text-bone-300">No activity recorded yet.</p>}
            </div>
            {(auditHistory.length > 0 || events.data?.nextCursor) && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-bone-600/25 pt-4">
                <button type="button" disabled={auditHistory.length === 0}
                  onClick={() => {
                    const previous = auditHistory[auditHistory.length - 1];
                    setAuditHistory((current) => current.slice(0, -1));
                    setAuditCursor(previous);
                  }}
                  className={buttonSecondary}>Newer events
                </button>
                <button type="button" disabled={!events.data?.nextCursor}
                  onClick={() => {
                    setAuditHistory((current) => [...current, auditCursor]);
                    setAuditCursor(events.data?.nextCursor ?? undefined);
                  }}
                  className={buttonSecondary}>Older events
                </button>
              </div>
            )}
          </AsyncBoundary>
        </section>
      </div>
    </>
  );
}
