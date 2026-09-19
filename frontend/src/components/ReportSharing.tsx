import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Trash2 } from 'lucide-react';
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
    <section className="mt-6 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-500">PRIVATE REPORT SHARING</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-400">
            Create a revocable bearer link for an intended reviewer. Anyone holding it can read this report until it expires, without gaining workspace access.
          </p>
        </div>
        <button type="button" onClick={() => void create()} disabled={creating}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 border border-signal-500/40 bg-signal-500/10 px-5 font-mono text-[11px] uppercase tracking-wider text-signal-300 disabled:opacity-50">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          CREATE 7-DAY LINK
        </button>
      </div>

      {createdUrl && (
        <div className="mt-5 border border-flux-500/30 bg-flux-500/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-flux-400">COPY NOW — THE TOKEN IS SHOWN ONCE</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={createdUrl} onFocus={(event) => event.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 border border-bone-600/30 bg-ink-950 px-3 font-mono text-xs text-bone-200 outline-none" />
            <button type="button" onClick={() => void copy(createdUrl)}
              className="flex min-h-11 items-center justify-center gap-2 border border-bone-600/30 px-4 font-mono text-[10px] uppercase tracking-wider text-bone-300">
              {copied ? <Check className="h-4 w-4 text-flux-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
        </div>
      )}

      {shares.error && <p role="alert" className="mt-4 text-xs text-fault-400">{shares.error}</p>}
      {active.length > 0 && (
        <div className="mt-5 space-y-2">
          {active.map((share) => (
            <div key={share.id} className="flex flex-col gap-3 border border-bone-600/20 bg-ink-950/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-mono text-[10px] uppercase tracking-wider text-bone-500">
                EXPIRES {formatDate(share.expiresAt)}
                {share.lastAccessedAt && <span className="ml-3 text-bone-600">LAST OPENED {formatDate(share.lastAccessedAt)}</span>}
              </div>
              <button type="button" onClick={() => void revoke(share.id)} disabled={revoking === share.id}
                className="flex min-h-9 items-center justify-center gap-2 border border-fault-500/30 px-3 font-mono text-[10px] uppercase tracking-wider text-fault-400 disabled:opacity-50">
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
