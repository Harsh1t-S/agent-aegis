import { motion } from 'framer-motion';
import { CountUp } from './CountUp';
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
  // The count-up lives in CountUp, which treats it as decoration over a value
  // that is already correct. Driving a MotionValue from here did the opposite:
  // `animate()` sets the value to its starting keyframe immediately and leaves the
  // frame loop to advance it, so anywhere frames did not arrive — a backgrounded
  // tab, a throttled device — this rendered a permanent 0. The headline reliability
  // of every agent, reported as zero, by an animation.

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
          className="inline-block"
          initial={{ opacity: 0.3 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <CountUp
            value={score}
            placeholder="0"
            className={`massive ${sizeMap[size]} text-bone-50`}
          />
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
