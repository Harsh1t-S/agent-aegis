import type { CiGate } from '@/types';
import { Check, X } from 'lucide-react';

/**
 * The same decision `python -m app.ci` makes, on the same numbers.
 *
 * The point of showing it is that the dashboard and the pipeline cannot disagree:
 * both read this endpoint, so a build that would fail in CI reads as failing here.
 */
export function CiGatePanel({ gate }: { gate: CiGate }) {
  return (
    <div
      className={`min-w-0 border p-4 sm:p-6 ${
        gate.passed
          ? 'border-flux-500/40 bg-flux-500/5'
          : 'border-fault-500/40 bg-fault-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={`font-display text-lg font-semibold ${gate.passed ? 'text-flux-300' : 'text-fault-300'}`}>
          CI gate: {gate.passed ? 'pass' : 'fail'}
        </h3>
        <span className="font-mono text-sm text-bone-300">exit {gate.exitCode}</span>
      </div>

      <div className="mt-5 space-y-2">
        {gate.gates.map((check) => (
          <div key={check.check} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                check.ok
                  ? 'border-flux-500/50 text-flux-500'
                  : 'border-fault-500/50 text-fault-500'
              }`}
            >
              {check.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
            </span>
            <span
              className={`min-w-0 break-words font-mono text-sm ${check.ok ? 'text-bone-200' : 'text-fault-300'}`}
            >
              {check.check}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-bone-600/20 pt-4 text-sm leading-relaxed text-bone-400">
        Thresholds: reliability ≥ {gate.thresholds.minScore} · critical ≤{' '}
        {gate.thresholds.maxCritical} · failed ≤ {gate.thresholds.maxFailed}. The
        agent-reliability workflow reads this endpoint and exits {gate.exitCode} on this run.
      </p>
    </div>
  );
}
