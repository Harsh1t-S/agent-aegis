/** @type {import('tailwindcss').Config} */

/*
 * The palette is warm-black with cool accents, on purpose.
 *
 * It used to be blue-black (#050507, hue 240) with lavender #8b5cf6 on top — the
 * same near-black-plus-purple every generated dashboard ships with, and it read as
 * exactly that. The problem was not the purple by itself: it was that the ground,
 * the text and the accent were all the same cool hue, so the whole screen was one
 * colour at three lightnesses and nothing looked chosen.
 *
 * So the ground is warm now — graphite with brown in it, the colour of anodised
 * metal rather than of space — and the accent is a cold instrument cyan sitting
 * opposite it on the wheel. Warm ground against cool accent is what makes a screen
 * look designed rather than defaulted, and it gives the status colours somewhere to
 * live: amber and vermilion read as signals against warm black instead of blending
 * into a blue field.
 *
 * The accent went through ultramarine on the way here and that was not far enough:
 * it still read as lavender at a glance, which is the only test that matters. Cyan
 * cannot be mistaken for the near-black-and-purple every generated dashboard ships
 * with.
 *
 * Colour carries meaning. Cyan is interactive, jade is a pass, amber a warning,
 * vermilion a failure — nothing is tinted for decoration, because the one thing this
 * product cannot afford is a reader who has learned to ignore its colours.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // Small phones (iPhone SE and narrower) sit below this. Several labels
        // need a shorter form there rather than wrapping into the logo.
        xs: '475px',
      },
      colors: {
        // Warm graphite. Hue ~30 rather than ~240 — the brown keeps it from
        // reading as "space", which is what the blue-black did.
        ink: {
          950: '#0b0a09',
          900: '#12100e',
          850: '#191613',
          800: '#211d19',
          750: '#29241f',
          700: '#322c26',
          650: '#3b342d',
          600: '#453d35',
        },
        // Bone: warm off-white through to warm grey.
        //
        // 500 and 600 used to be #5a5a66 and #3e3e48 — 2.1:1 and 1.5:1 against the
        // background. Every "small text is not visible" complaint was one of these:
        // the labels were technically rendered and practically invisible.
        //
        // The two dimmest steps are now set by measurement, not by eye: 600 is
        // 4.77:1 and 500 is 5.76:1 against ink-950, so even an 10px mono label at
        // the quietest weight in the product clears WCAG AA for body text. Anything
        // dimmer than 600 does not exist, because there is nothing worth saying
        // that is not worth being able to read.
        bone: {
          50: '#f6f2ea',
          100: '#eae4d8',
          200: '#d6cfc0',
          300: '#bcb3a1',
          400: '#a1977f',
          500: '#948a77',
          600: '#857c6d',
        },
        // Interactive.
        //
        // Named `signal`, not `violet`, because it is not violet any more and a
        // token that lies about its own colour is how purple gets reintroduced by
        // accident. The first pass moved this to ultramarine and it still read as
        // lavender on screen — the honest test is whether someone glancing at it
        // says "purple", and #8b96ff did.
        //
        // This is a cold instrument cyan: it sits opposite warm graphite on the
        // wheel, which is what makes the pairing look deliberate, and it cannot be
        // mistaken for the near-black-and-purple default.
        signal: {
          300: '#8fe3f7',
          400: '#5bc8e8',
          500: '#26a9d0',
          600: '#1a87ab',
          700: '#146a87',
        },
        // A data colour, not an accent — it exists so the five reliability
        // dimensions stay distinguishable from each other. Moved off cyan when the
        // interactive accent took it.
        spark: {
          400: '#7d8cff',
          500: '#5566e8',
          600: '#3f4ec4',
        },
        // Pass — jade, warmed slightly so it belongs on this ground.
        flux: {
          300: '#7ff0b6',
          400: '#4ade9b',
          500: '#22c57e',
          600: '#16a463',
        },
        // Failure — vermilion rather than fire-engine red; it separates cleanly
        // from amber at small sizes, which pure red does not.
        fault: {
          300: '#ff9b8c',
          400: '#ff7a68',
          500: '#f05540',
          600: '#d13d29',
        },
        // Warning — amber.
        warn: {
          300: '#ffd97a',
          400: '#fbc44a',
          500: '#eda31c',
          600: '#c88210',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        ultraTight: '-0.04em',
        tightest: '-0.03em',
      },
      animation: {
        'spin-slow': 'spin 24s linear infinite',
        'spin-rev': 'spin-rev 32s linear infinite',
        'pulse-ring': 'pulse-ring 4s ease-in-out infinite',
        'drift': 'drift 18s ease-in-out infinite',
        'flicker': 'flicker 6s steps(4) infinite',
      },
      keyframes: {
        'spin-rev': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.4' },
          '50%': { transform: 'scale(1.15)', opacity: '0.1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(8px, -12px)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
