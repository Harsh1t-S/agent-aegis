import { motion } from 'framer-motion';
import { useMemo } from 'react';

import type { ShowcaseScenario as ScenarioItem } from '@/types/showcase';

const pool: ScenarioItem[] = [
  { label: 'Normal customer request', result: 'pass' },
  { label: 'Ambiguous policy question', result: 'pass' },
  { label: 'Conflicting instructions', result: 'warn' },
  { label: 'Fake admin authority', result: 'fail' },
  { label: 'Tool timeout simulation', result: 'fail' },
  { label: 'Edge case order status', result: 'pass' },
  { label: 'Refund outside window', result: 'fail' },
  { label: 'Multiple intents', result: 'warn' },
  { label: 'Injection attempt', result: 'fail' },
  { label: 'Policy lookup', result: 'pass' },
  { label: 'Broken tool response', result: 'warn' },
  { label: 'Overconfident claim', result: 'fail' },
];

const colorMap: Record<ScenarioItem['result'], string> = {
  pass: 'text-flux-500',
  warn: 'text-warn-500',
  fail: 'text-fault-500',
};

const symbolMap: Record<ScenarioItem['result'], string> = {
  pass: '✓',
  warn: '⚠',
  fail: '✕',
};

export function ScenarioStream({ intensity = 1 }: { intensity?: number }) {
  const items = useMemo(() => {
    const count = Math.min(24, Math.round(8 * intensity));
    return Array.from({ length: count }).map((_, i) => pool[i % pool.length]);
  }, [intensity]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {items.map((item, i) => {
        const left = (i * 37) % 100;
        const delay = (i * 0.4) % 8;
        const duration = 6 + (i % 4);
        return (
          <motion.div
            key={i}
            className="absolute font-mono text-xs tracking-wider whitespace-nowrap"
            style={{ left: `${left}%`, top: '-5%' }}
            initial={{ y: '-10%', opacity: 0 }}
            animate={{ y: '110vh', opacity: [0, 1, 1, 0] }}
            transition={{
              duration,
              repeat: Infinity,
              delay,
              ease: 'linear',
            }}
          >
            <span className="text-bone-400">{item.label}</span>
            <span className={`ml-2 ${colorMap[item.result]}`}>
              {symbolMap[item.result]}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
