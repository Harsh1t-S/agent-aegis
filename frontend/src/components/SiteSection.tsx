import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Backdrop } from '@/components/Backdrop';

/*
 * Building blocks for the public pages, so every page below the landing hero
 * speaks its language: the grid floor and glow behind a page's opening, a short
 * cyan rule over each section heading, a gradient on the words a heading turns
 * on, and panels drawn like the hero's console.
 */

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/** The words a heading turns on, in the hero's cyan gradient (or red, for a failure). */
export function Accent({ children, tone = 'signal' }: { children: ReactNode; tone?: 'signal' | 'fault' }) {
  const gradient = tone === 'fault'
    ? 'from-fault-300 via-fault-400 to-fault-600'
    : 'from-signal-300 via-signal-400 to-signal-600';
  return <span className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{children}</span>;
}

/** The line above a section heading. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 text-sm font-medium text-signal-300 ${className}`}>
      <span aria-hidden className="h-px w-8 bg-gradient-to-r from-signal-400 to-transparent" />
      {children}
    </p>
  );
}

const GLOWS = {
  top: 'bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(38,169,208,0.12),transparent_70%)]',
  left: 'bg-[radial-gradient(ellipse_45%_60%_at_0%_45%,rgba(38,169,208,0.10),transparent_70%)]',
  right: 'bg-[radial-gradient(ellipse_45%_60%_at_100%_45%,rgba(38,169,208,0.10),transparent_70%)]',
  fault: 'bg-[radial-gradient(ellipse_45%_55%_at_15%_40%,rgba(240,85,64,0.09),transparent_70%)]',
};

/** A soft light behind a section, so long pages keep the hero's depth without its grid. */
export function Glow({ at }: { at: keyof typeof GLOWS }) {
  return <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 ${GLOWS[at]}`} />;
}

/** The opening of a public page: the hero's grid floor, an eyebrow pill, a heading and a lead. */
export function PageHero({ eyebrow, title, lead, children, aside, center = false }: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Calls to action under the lead. */
  children?: ReactNode;
  /** A panel beside the text on a wide screen, below it on a phone. */
  aside?: ReactNode;
  /** Centre the text, for a page whose content below is a narrow centred column. */
  center?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-16 pt-32 sm:px-8 lg:px-12 lg:pb-24 lg:pt-40">
      <Backdrop />
      <div className={`relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 ${aside ? 'lg:grid-cols-[1.05fr_0.95fr] lg:gap-16' : ''}`}>
        <div className={center ? 'mx-auto min-w-0 max-w-3xl text-center' : 'min-w-0'}>
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2.5 border border-signal-500/40 bg-signal-500/10 px-3 py-1.5 text-sm text-signal-200"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-signal-400" />
            {eyebrow}
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            className="mt-7 max-w-4xl font-display text-[clamp(2.5rem,5.6vw,5rem)] font-bold leading-[0.98] tracking-ultraTight text-bone-50"
          >
            {title}
          </motion.h1>
          {lead && (
            <motion.p {...rise(0.16)} className={`mt-6 max-w-2xl text-lg leading-relaxed text-bone-300 ${center ? 'mx-auto' : ''}`}>
              {lead}
            </motion.p>
          )}
          {children && <motion.div {...rise(0.24)} className="mt-9">{children}</motion.div>}
        </div>
        {aside && (
          <motion.div
            className="min-w-0"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {aside}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/** A panel drawn like the hero's console: three lights, a monospace label, a badge. */
export function ConsoleFrame({ label, badge, children, className = '' }: {
  label: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative border border-bone-600/35 bg-ink-950/80 shadow-[0_40px_100px_-45px_rgba(38,169,208,0.45)] backdrop-blur ${className}`}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal-400/70 to-transparent" />
      <div className="flex items-center justify-between gap-3 border-b border-bone-600/25 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-fault-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-flux-500/80" />
          </span>
          <span className="truncate font-mono text-xs text-bone-300">{label}</span>
        </div>
        {badge}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
