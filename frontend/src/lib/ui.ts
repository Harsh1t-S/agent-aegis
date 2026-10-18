/**
 * Shared styles for the console.
 *
 * Every screen used to style its own buttons, cards and fields, so the same thing
 * looked different from page to page. One spacing scale (4, 6, 8) and one set of
 * sizes: body text is 14px or more, labels are 12px or more, and every control is
 * at least 44px tall so it can be hit on a phone.
 *
 * Buttons: one primary per screen, in the page header; everything else secondary.
 */
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400 disabled:cursor-not-allowed disabled:opacity-40';

export const buttonPrimary =
  `${base} border-signal-400 bg-signal-500 text-ink-950 hover:bg-signal-400`;

export const buttonSecondary =
  `${base} border-bone-600/45 text-bone-100 hover:border-bone-300/60 hover:bg-ink-850`;

export const buttonDanger =
  `${base} border-fault-500/50 text-fault-300 hover:bg-fault-500/10`;

/** A bordered surface. Padding steps down on a phone so cards do not squeeze text. */
export const card = 'border border-bone-600/25 bg-ink-900 p-4 sm:p-6';

/** The heading inside a card or a page section. */
export const sectionTitle = 'font-display text-lg font-semibold text-bone-50';

/**
 * Form field label, input and helper text. Inputs are 16px on a phone because iOS
 * zooms the page into any field set smaller than that.
 */
export const fieldLabel = 'block text-sm font-medium text-bone-200';
export const fieldInput =
  'min-h-11 w-full border border-bone-600/40 bg-ink-950 px-3 text-base text-bone-50 placeholder:text-bone-500 focus-visible:border-signal-400 sm:text-sm';
export const fieldHint = 'mt-1.5 text-sm text-bone-400';

/** The outcome of a form, shown under it: what went wrong, or what happens next. */
export const noticeError =
  'flex items-start gap-2 border border-fault-500/40 bg-fault-500/10 p-3 text-sm leading-relaxed text-fault-300';
export const noticeSuccess =
  'flex items-start gap-2 border border-flux-500/40 bg-flux-500/10 p-3 text-sm leading-relaxed text-flux-300';
