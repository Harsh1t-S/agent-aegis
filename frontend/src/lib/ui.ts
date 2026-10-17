/**
 * Shared button styles for the console.
 *
 * Every screen used to style its own buttons, so the same action looked different
 * from page to page. These two cover every action: one primary per screen, the
 * rest secondary.
 */
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 border px-4 font-mono text-xs uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400 disabled:cursor-not-allowed disabled:opacity-40';

export const buttonPrimary =
  `${base} border-signal-500/50 bg-signal-500/15 text-signal-300 hover:bg-signal-500/25 hover:text-signal-300`;

export const buttonSecondary =
  `${base} border-bone-600/35 text-bone-200 hover:border-bone-400/60 hover:text-bone-50`;

export const buttonDanger =
  `${base} border-fault-500/40 text-fault-300 hover:bg-fault-500/10`;
