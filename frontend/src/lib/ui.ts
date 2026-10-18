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

/**
 * A bordered surface. Padding steps down on a phone so cards do not squeeze text.
 * The faint cyan line along the top edge is the public site's console frame, drawn
 * as a background so the card never becomes a positioning context.
 */
export const card =
  'border border-bone-600/25 bg-ink-900 bg-[linear-gradient(90deg,transparent,rgba(91,200,232,0.45),transparent)] bg-[length:100%_1px] bg-no-repeat p-4 sm:p-6';

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

/**
 * The public site speaks the landing hero's language: sentence-case display
 * headings with a cyan gradient on the words that matter, larger calls to action,
 * and the primary one carrying the hero's glow.
 */
export const ctaPrimary =
  'group inline-flex min-h-12 items-center justify-center gap-2 border border-signal-400 bg-signal-500 px-6 text-base font-semibold text-ink-950 shadow-[0_0_44px_-10px_rgba(38,169,208,0.85)] transition-colors hover:bg-signal-400';
export const ctaSecondary =
  'inline-flex min-h-12 items-center justify-center gap-2 border border-bone-600/50 bg-ink-900/40 px-6 text-base font-medium text-bone-100 backdrop-blur transition-colors hover:border-bone-300/70 hover:text-bone-50';
export const siteHeading =
  'font-display text-[clamp(2.1rem,4.4vw,3.5rem)] font-bold leading-[1.04] tracking-tightest text-bone-50';
export const siteLead = 'text-base leading-relaxed text-bone-300 sm:text-lg';
/** A public-site card: a cyan hairline lights along its top edge on hover. */
export const siteCard =
  'group relative border border-bone-600/30 bg-ink-900/60 p-6 transition-colors duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-signal-400/80 before:to-transparent before:opacity-0 before:transition-opacity hover:border-signal-400/40 hover:before:opacity-100 sm:p-7';

/** The outcome of a form, shown under it: what went wrong, or what happens next. */
export const noticeError =
  'flex items-start gap-2 border border-fault-500/40 bg-fault-500/10 p-3 text-sm leading-relaxed text-fault-300';
export const noticeSuccess =
  'flex items-start gap-2 border border-flux-500/40 bg-flux-500/10 p-3 text-sm leading-relaxed text-flux-300';
