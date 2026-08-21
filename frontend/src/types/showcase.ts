/**
 * Types for the marketing page's illustrative visuals.
 *
 * Kept apart from `@/types` on purpose: those mirror the API, and a decorative
 * animation must never be able to typecheck as real evaluation data.
 */

export interface ShowcaseTraceEvent {
  id: number;
  label: string;
  detail?: string;
  status: 'ok' | 'fail' | 'warn';
}

export interface ShowcaseScenario {
  label: string;
  result: 'pass' | 'warn' | 'fail';
}
