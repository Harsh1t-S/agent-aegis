import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { useEffect, useState } from 'react';
import { verdictFor } from '@/lib/format';

interface ReliabilityScoreProps {
  score: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  sublabel?: string;
}

// Fixed type sizes were the single biggest source of horizontal bleed on a
// phone: `xl` rendered 192px digits, so the score alone was wider than a 375px
// viewport before any padding was added around it.
const sizeMap = {
  sm: 'text-4xl sm:text-5xl',
  md: 'text-5xl sm:text-6xl md:text-7xl',
  lg: 'text-6xl sm:text-7xl md:text-8xl',
  xl: 'text-[4.5rem] sm:text-[7rem] md:text-[12rem] lg:text-[16rem]',
};

export function ReliabilityScore({
  score,
  max = 100,
  size = 'lg',
  label = 'RELIABILITY SCORE',
  sublabel,
}: ReliabilityScoreProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  // Seeded with the real score, not zero. This is the headline number of the whole
  // product, and it must never be capable of displaying something that is not the
  // score — the count-up is decoration on top of a value that is already correct.
  const [display, setDisplay] = useState(() => Math.round(score));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setDisplay(Math.round(score));
    // `animate()` is imperative, so the app-level MotionConfig does not reach it.
    // Without this check a reader with reduced motion enabled saw the count-up
    // never start and the score sat at 0 permanently — the product reporting a
    // reliability of zero for every agent, to exactly the people least able to
    // tell it was an animation bug.
    if (reduceMotion) return;

    count.set(0);
    const controls = animate(count, score, { duration: 1.8, ease: [0.22, 1, 0.36, 1] });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    // A dropped or throttled final frame must not leave the number short of the
    // value it is reporting.
    void controls.finished.then(() => setDisplay(Math.round(score))).catch(() => undefined);
    return () => {
      controls.stop();
      unsub();
      setDisplay(Math.round(score));
    };
  }, [score, count, rounded, reduceMotion]);

  // These thresholds used to be 85/70 with their own wording, so the same score
  // read "NEEDS IMPROVEMENT" on the control centre and "Needs Attention" on its
  // own report. One score, one published set of bands.
  const tier = verdictFor(score).toUpperCase();
  const tierColor =
    score >= 90 ? 'text-flux-400' : score >= 75 ? 'text-warn-400' : 'text-fault-400';

  return (
    <div className="flex w-full min-w-0 flex-col items-center text-center">
      <div className="flex items-start">
        <motion.span
          className={`massive ${sizeMap[size]} text-bone-50`}
          initial={{ opacity: 0.3 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {display}
        </motion.span>
        <span
          className={`font-mono mt-2 ${
            size === 'xl' ? 'text-lg sm:text-2xl md:text-3xl' : 'text-base sm:text-lg'
          } text-bone-500`}
        >
          /{max}
        </span>
      </div>
      {label && <span className="tech-label mt-2 break-words">{label}</span>}
      {sublabel && <span className="tech-label mt-1 text-bone-600">{sublabel}</span>}
      <span className={`tech-label mt-3 ${tierColor}`}>{tier}</span>
    </div>
  );
}
