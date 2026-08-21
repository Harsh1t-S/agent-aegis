import { motion } from 'framer-motion';

interface MetricLineProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  color?: string;
  delay?: number;
}

export function MetricLine({
  label,
  value,
  max = 100,
  unit = '%',
  color = '#8b5cf6',
  delay = 0,
}: MetricLineProps) {
  const pct = (value / max) * 100;

  return (
    <div className="group">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-bone-300">{label}</span>
        <span className="font-mono text-lg font-semibold text-bone-50">
          {value}
          <span className="text-sm text-bone-500">{unit}</span>
        </span>
      </div>
      <div className="relative mt-2 h-px w-full bg-bone-600/30">
        <motion.div
          className="absolute left-0 top-0 h-px"
          style={{ background: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ left: 0, opacity: 0 }}
          whileInView={{ left: `${pct}%`, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
