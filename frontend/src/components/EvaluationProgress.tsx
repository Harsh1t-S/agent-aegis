import { motion } from 'framer-motion';

interface EvaluationProgressProps {
  complete: number;
  total: number;
  status: 'running' | 'completed' | 'failed';
}

export function EvaluationProgress({ complete, total, status }: EvaluationProgressProps) {
  const pct = total > 0 ? (complete / total) * 100 : 0;

  // Only two of these are observable from the progress endpoint. Claiming the
  // others as done — as a fixed checklist did — is exactly the kind of unverified
  // status report this product exists to flag.
  const stages = [
    { label: 'SCENARIOS GENERATED', done: total > 0 },
    { label: 'SANDBOX INITIALIZED', done: total > 0 },
    {
      label: 'RUNNING SCENARIOS',
      done: status === 'completed',
      active: status === 'running' && total > 0,
    },
    { label: 'SCORING COMPLETE', done: status === 'completed' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm text-bone-300">
            {complete} / {total || '—'} SCENARIOS COMPLETE
          </span>
          <span className="font-mono text-sm text-signal-400">{Math.round(pct)}%</span>
        </div>
        <div className="relative mt-3 h-1 w-full bg-bone-600/20">
          <motion.div
            className="absolute left-0 top-0 h-1 bg-gradient-to-r from-signal-500 to-spark-500"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-3">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                stage.done
                  ? 'border-flux-500/50 text-flux-500'
                  : stage.active
                    ? 'border-signal-500 text-signal-400'
                    : 'border-bone-600/40 text-bone-600'
              }`}
            >
              {stage.done ? '✓' : stage.active ? '◉' : '○'}
            </span>
            <span
              className={`font-mono text-xs uppercase tracking-wider ${
                stage.done ? 'text-bone-300' : stage.active ? 'text-signal-400' : 'text-bone-600'
              }`}
            >
              {stage.label}
            </span>
            {stage.active && (
              <motion.span
                className="ml-auto h-1 w-8 bg-signal-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
