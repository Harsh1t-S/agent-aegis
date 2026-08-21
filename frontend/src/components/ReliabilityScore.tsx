import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ReliabilityScoreProps {
  score: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  sublabel?: string;
}

const sizeMap = {
  sm: 'text-5xl',
  md: 'text-7xl',
  lg: 'text-8xl',
  xl: 'text-[12rem] md:text-[16rem]',
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
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, score, { duration: 1.8, ease: [0.22, 1, 0.36, 1] });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [score, count, rounded]);

  const tier =
    score >= 85 ? 'HIGHLY RELIABLE' : score >= 70 ? 'MODERATELY RELIABLE' : 'NEEDS IMPROVEMENT';
  const tierColor =
    score >= 85 ? 'text-flux-400' : score >= 70 ? 'text-warn-400' : 'text-fault-400';

  return (
    <div className="flex flex-col items-center text-center">
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
        <span className={`font-mono mt-2 ${size === 'xl' ? 'text-3xl' : 'text-lg'} text-bone-500`}>
          /{max}
        </span>
      </div>
      {label && <span className="tech-label mt-2">{label}</span>}
      {sublabel && <span className="tech-label mt-1 text-bone-600">{sublabel}</span>}
      <span className={`tech-label mt-3 ${tierColor}`}>{tier}</span>
    </div>
  );
}
