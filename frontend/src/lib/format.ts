import type { AgentStatus, Severity, TestStatus } from '@/types';

/** The bands the API publishes at /scoring. Kept here only for labels. */
export function verdictFor(score: number): string {
  if (score >= 90) return 'Highly Reliable';
  if (score >= 75) return 'Moderately Reliable';
  return 'Needs Attention';
}

/** A signed delta, with the sign always shown so a drop cannot read as a gain. */
export function signed(delta: number, digits = 1): string {
  const value = Number(delta.toFixed(digits));
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export function deltaTone(delta: number): string {
  if (delta > 0) return 'text-flux-400';
  if (delta < 0) return 'text-fault-400';
  return 'text-bone-400';
}

export function formatDate(iso: string): string {
  if (!iso) return 'Never evaluated';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString(undefined, { hour12: false });
}

export const severityTone: Record<Severity, string> = {
  critical: 'text-fault-500 border-fault-500/60',
  high: 'text-fault-400 border-fault-500/40',
  medium: 'text-warn-500 border-warn-500/40',
  low: 'text-bone-400 border-bone-600/40',
};

export const testStatusTone: Record<TestStatus, { color: string; symbol: string; label: string }> = {
  passed: { color: 'text-flux-500', symbol: '✓', label: 'PASSED' },
  failed: { color: 'text-fault-500', symbol: '✕', label: 'FAILED' },
  warning: { color: 'text-warn-500', symbol: '⚠', label: 'WARNING' },
};

export const agentStatusTone: Record<AgentStatus, string> = {
  reliable: 'text-flux-400',
  'needs-attention': 'text-warn-400',
  critical: 'text-fault-400',
  'never-run': 'text-bone-400',
};

export const agentStatusLabel: Record<AgentStatus, string> = {
  reliable: 'reliable',
  'needs-attention': 'needs attention',
  critical: 'critical',
  'never-run': 'never run',
};

/** Shown as `—` rather than `0` so an un-run agent cannot read as a zero score. */
export function scoreOrDash(score: number, hasRun: boolean): string {
  return hasRun ? score.toFixed(1) : '—';
}
