/**
 * The colours that have to exist as values, not classes.
 *
 * SVG fills, box-shadow glows and framer-motion `style` objects cannot take a
 * Tailwind class, so a handful of components hardcoded hex literals. Every one of
 * them was a copy of the old palette, and every one of them survived the redesign
 * unchanged — a component still glowing lavender on a warm-black page is exactly
 * the kind of drift that makes a design look assembled rather than made.
 *
 * These mirror `tailwind.config.js`. Anything reaching for a raw colour takes it
 * from here, so there is one place to change and one place to check.
 */
export const palette = {
  ink950: '#0b0a09',
  ink900: '#12100e',
  ink850: '#191613',
  ink600: '#453d35',

  bone50: '#f6f2ea',
  bone300: '#bcb3a1',
  bone400: '#a1977f',
  bone500: '#8b8270',
  bone600: '#7a7264',

  /** Interactive. */
  signal400: '#5bc8e8',
  signal500: '#26a9d0',
  /** A data colour for the metric lines, not an accent. */
  spark400: '#7d8cff',
  /** Pass. */
  flux500: '#22c57e',
  /** Failure. */
  fault400: '#ff7a68',
  fault500: '#f05540',
  /** Warning. */
  warn500: '#eda31c',
} as const;

/**
 * One colour per reliability dimension, used by every MetricLine in the app.
 *
 * They were spelled out as hex literals at five separate call sites, which is how
 * the agent page and the evaluation report came to draw the same five metrics in
 * slightly different colours.
 */
export const METRIC_COLORS: Record<string, string> = {
  taskSuccess: palette.signal500,
  // The lighter step: these draw a 1px line and a 6px dot, and the 500
  // sat at 4.19:1 against the ground — fine for a filled control, thin
  // for a hairline.
  toolAccuracy: palette.spark400,
  safety: palette.flux500,
  consistency: palette.bone300,
  groundedness: palette.warn500,
};

/** rgba() forms, for glows and borders that need an alpha channel. */
export const alpha = {
  signal: (a: number) => `rgba(91, 200, 232, ${a})`,
  fault: (a: number) => `rgba(240, 85, 64, ${a})`,
  bone: (a: number) => `rgba(139, 130, 112, ${a})`,
};
