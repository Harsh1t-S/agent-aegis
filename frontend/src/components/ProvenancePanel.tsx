import { useState } from 'react';
import { SystemLabel } from './SystemLabel';
import { useToast } from './Toaster';
import { api, ApiError } from '@/lib/api';
import type { EvaluationProvenance } from '@/types';
import { CheckCircle2, History, Loader2, RefreshCw } from 'lucide-react';

/**
 * Which evaluator produced the numbers above.
 *
 * A reviewer found the deployed evaluator was several versions ahead of the
 * results the console was showing, and nothing on the page said so: a verdict from
 * older semantics looked exactly like a fresh one. Evidence with no stated
 * provenance is evidence a judge is right not to trust, so the report states it —
 * and, when it is stale for a detector reason, offers the fix.
 *
 * Re-grading replays the *stored* trace through the current detectors. It calls no
 * model, invents no evidence, and cannot change what the agent actually did — the
 * one form of replay that is genuinely reproducible.
 */
export function ProvenancePanel({
  evaluationId,
  provenance,
  onReanalyzed,
}: {
  evaluationId: string;
  provenance: EvaluationProvenance;
  onReanalyzed: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const recorded = provenance.recorded ?? provenance.expected;
  const current = provenance.current;

  // Only the detector half can be brought forward by a replay. An old *oracle*
  // needs the scenario regenerating, and offering a button that cannot fix it
  // would be the same overclaiming this panel exists to prevent.
  const detectorStale =
    !current && provenance.recorded !== null &&
    provenance.recorded.detector !== provenance.expected.detector;

  const reanalyze = async () => {
    setBusy(true);
    try {
      const result = await api.reanalyze(evaluationId);
      toast.success(
        `Re-graded ${result.replayed} scenario${result.replayed === 1 ? '' : 's'}`,
        result.changed
          ? `${result.changed} verdict${result.changed === 1 ? '' : 's'} changed under ${result.detectorVersion}.`
          : `No verdict changed — the stored results already agree with ${result.detectorVersion}.`,
      );
      onReanalyzed();
    } catch (err) {
      toast.error(
        'Could not re-grade',
        err instanceof ApiError ? err.message : 'The replay did not complete.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`min-w-0 border p-5 sm:p-6 ${
        current ? 'border-bone-600/20 bg-ink-900/60' : 'border-warn-500/35 bg-warn-500/5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {current ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-flux-400" strokeWidth={1.5} />
          ) : (
            <History className="h-4 w-4 shrink-0 text-warn-400" strokeWidth={1.5} />
          )}
          <SystemLabel className={current ? 'text-flux-400' : 'text-warn-400'}>
            {current ? 'GRADED BY THE DEPLOYED EVALUATOR' : 'GRADED BY AN EARLIER EVALUATOR'}
          </SystemLabel>
        </div>
        {detectorStale && (
          <button
            type="button"
            onClick={reanalyze}
            disabled={busy}
            className="flex min-h-11 items-center gap-2 border border-signal-500/40 bg-signal-500/10 px-4 font-mono text-[11px] uppercase tracking-wider text-signal-300 transition-colors enabled:hover:bg-signal-500/20 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            RE-GRADE STORED TRACES
          </button>
        )}
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-300">
        {current
          ? 'Every scenario in this run was graded by the evaluator currently deployed, so the numbers above and the code in the repository are the same thing.'
          : provenance.reason}
        {!current && provenance.runsTotal > 0 && (
          <>
            {' '}
            <span className="text-bone-400">
              ({provenance.runsCurrent} of {provenance.runsTotal} scenarios are current.)
            </span>
          </>
        )}
      </p>

      <div className="mt-4 grid gap-px overflow-hidden border border-bone-600/20 bg-bone-600/20 sm:grid-cols-2 lg:grid-cols-4">
        {(['generator', 'guardrail', 'detector', 'profile', 'scorer'] as const).map((key) => {
          const drifted = recorded[key] !== provenance.expected[key];
          return (
            <div key={key} className="min-w-0 bg-ink-900/90 p-3">
              <SystemLabel className="text-bone-600">{key.toUpperCase()}</SystemLabel>
              <div
                className={`mt-1 truncate font-mono text-xs ${
                  drifted ? 'text-warn-300' : 'text-bone-200'
                }`}
              >
                {provenance.mixed ? 'mixed' : recorded[key]}
              </div>
              {drifted && !provenance.mixed && (
                <div className="mt-0.5 truncate font-mono text-[10px] text-bone-500">
                  deployed: {provenance.expected[key]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[10px] text-bone-600">
        Evaluator commit{' '}
        <span className="text-bone-400">
          {(provenance.mixed ? provenance.expected.commit : recorded.commit).slice(0, 12)}
        </span>
        {detectorStale &&
          ' · re-grading replays the stored trace through the current detectors — no model is called and no new evidence is created.'}
      </p>
    </div>
  );
}
