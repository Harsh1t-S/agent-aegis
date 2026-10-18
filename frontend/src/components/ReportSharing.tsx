import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Trash2 } from 'lucide-react';
import { buttonDanger, buttonSecondary } from '@/lib/ui';
import { useResource } from '@/hooks/useResource';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toaster';

export function ReportSharing({ evaluationId }: { evaluationId: string }) {
  const toast = useToast();
  const shares = useResource(() => api.reportShares(evaluationId), [evaluationId]);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Link not copied', 'Select the link and copy it manually.');
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const share = await api.createReportShare(evaluationId, 7);
      const url = new URL(share.path, window.location.origin).toString();
      setCreatedUrl(url);
      shares.reload();
      await copy(url);
      toast.success('Private link created', 'It expires in seven days and can be revoked here.');
    } catch (cause) {
      toast.error('Link not created', cause instanceof ApiError ? cause.message : 'Try again.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.revokeReportShare(id);
      shares.reload();
      toast.success('Private link revoked', 'It can no longer open the report.');
    } catch (cause) {
      toast.error('Link not revoked', cause instanceof ApiError ? cause.message : 'Try again.');
    } finally {
      setRevoking(null);
    }
  };

  const active = (shares.data ?? []).filter((share) => share.active);

  return (
    <section className="border border-bone-600/30 bg-ink-900 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-bone-50">Private report sharing</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-bone-300">
            Create a revocable bearer link for an intended reviewer. Anyone holding it can read this report until it expires, without gaining workspace access.
          </p>
        </div>
        <button type="button" onClick={() => void create()} disabled={creating}
          className={`${buttonSecondary} shrink-0`}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create 7-day link
        </button>
      </div>

      {createdUrl && (
        <div className="mt-5 border border-flux-500/30 bg-flux-500/5 p-4">
          <p className="text-sm font-medium text-flux-300">Copy it now. The link is shown once.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={createdUrl} onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 border border-bone-600/40 bg-ink-950 px-3 font-mono text-sm text-bone-100" />
            <button type="button" onClick={() => void copy(createdUrl)}
              className={buttonSecondary}>
              {copied ? <Check className="h-4 w-4 text-flux-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'COPY'}
            </button>
          </div>
        </div>
      )}

      {shares.error && <p role="alert" className="mt-4 text-xs text-fault-400">{shares.error}</p>}
      {active.length > 0 && (
        <div className="mt-5 space-y-2">
          {active.map((share) => (
            <div key={share.id} className="flex flex-col gap-3 border border-bone-600/20 bg-ink-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-bone-500">
                EXPIRES {formatDate(share.expiresAt)}
                {share.lastAccessedAt && <span className="ml-3 text-bone-400">Last opened {formatDate(share.lastAccessedAt)}</span>}
              </div>
              <button type="button" onClick={() => void revoke(share.id)} disabled={revoking === share.id}
                className={buttonDanger}>
                {revoking === share.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                REVOKE
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
