import type { CiGate } from '@/types';
import { SystemLabel } from './SystemLabel';
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
      className={`border p-6 ${
        gate.passed
          ? 'border-flux-500/30 bg-flux-500/5'
          : 'border-fault-500/30 bg-fault-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SystemLabel className={gate.passed ? 'text-flux-400' : 'text-fault-400'}>
          CI GATE — {gate.passed ? 'PASS' : 'FAIL'}
        </SystemLabel>
        <span className="font-mono text-[11px] text-bone-500">exit {gate.exitCode}</span>
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
              className={`font-mono text-xs ${check.ok ? 'text-bone-300' : 'text-fault-300'}`}
            >
              {check.check}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-bone-600/20 pt-4 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-bone-600">
        Thresholds: reliability ≥ {gate.thresholds.minScore} · critical ≤{' '}
        {gate.thresholds.maxCritical} · failed ≤ {gate.thresholds.maxFailed}. The
        agent-reliability workflow reads this endpoint and exits {gate.exitCode} on this run.
      </p>
    </div>
  );
}
