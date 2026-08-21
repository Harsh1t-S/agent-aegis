/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Near-black / deep charcoal backgrounds
        ink: {
          950: '#050507',
          900: '#0a0a0f',
          850: '#0f0f16',
          800: '#14141c',
          750: '#1a1a24',
          700: '#20202c',
          650: '#262633',
          600: '#2d2d3a',
        },
        // Off-white / muted text
        bone: {
          50: '#f5f5f7',
          100: '#e8e8ec',
          200: '#d1d1d8',
          300: '#a8a8b2',
          400: '#7a7a86',
          500: '#5a5a66',
          600: '#3e3e48',
        },
        // Primary accent — vivid electric violet
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        // Secondary accent — electric blue
        spark: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        // Success — luminous green
        flux: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
        // Failure — vivid red
        fault: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        // Warning — amber
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
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
