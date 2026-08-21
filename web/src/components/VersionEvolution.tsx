import { motion } from 'framer-motion';
import type { AgentVersion } from '@/types';
import { deltaTone, signed } from '@/lib/format';
import { ScrollReveal } from './ScrollReveal';
import { SystemLabel } from './SystemLabel';

const metricLabels: { key: keyof AgentVersion['metrics']; label: string }[] = [
  { key: 'taskSuccess', label: 'TASK SUCCESS' },
  { key: 'toolAccuracy', label: 'TOOL ACCURACY' },
  { key: 'safety', label: 'SAFETY' },
  { key: 'consistency', label: 'CONSISTENCY' },
  { key: 'groundedness', label: 'GROUNDEDNESS' },
];

export function VersionEvolution({ versions }: { versions: AgentVersion[] }) {
  if (versions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-bone-400">
        This agent has not been evaluated yet, so there is no version history to chart.
      </p>
    );
  }

  const first = versions[0];
  const last = versions[versions.length - 1];
  // Bars are drawn against a fixed 0–100 axis. Rescaling to the data made a
  // 30 → 31 move look like a transformation.
  const barHeight = (score: number) => Math.max(2, Math.min(100, score));

  return (
    <div className="relative">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:gap-4">
        {versions.map((v, i) => (
          <ScrollReveal key={v.id} delay={Math.min(i, 6) * 0.1} className="flex-1">
            <div className="flex flex-col items-center">
              <span className="font-mono text-3xl font-bold text-bone-50">
                {v.reliability.toFixed(1)}
              </span>
              <SystemLabel className="mt-1">{v.version}</SystemLabel>
              <div className="relative mt-3 h-32 w-full">
                <motion.div
                  className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-violet-600/40 to-violet-500/80"
                  initial={{ height: 0 }}
                  whileInView={{ height: `${barHeight(v.reliability)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: Math.min(i, 6) * 0.1, ease: [0.22, 1, 0.36, 1] }}
                />
                <div className="absolute bottom-0 left-0 h-px w-full bg-bone-600/30" />
              </div>
              <span className="mt-2 text-center font-mono text-[10px] text-bone-500">
                {v.passRate.toFixed(0)}% pass
              </span>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {versions.length > 1 && (
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {metricLabels.map((m) => {
            const delta = last.metrics[m.key] - first.metrics[m.key];
            return (
              <div
                key={m.key}
                className="flex items-center justify-between border border-bone-600/20 px-4 py-3"
              >
                <SystemLabel>{m.label}</SystemLabel>
                <span className={`font-mono text-sm font-semibold ${deltaTone(delta)}`}>
                  {signed(delta)} pts
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between border border-bone-600/20 px-4 py-3">
            <SystemLabel>RELIABILITY</SystemLabel>
            <span
              className={`font-mono text-sm font-semibold ${deltaTone(last.reliability - first.reliability)}`}
            >
              {signed(last.reliability - first.reliability)} pts
            </span>
          </div>
        </div>
      )}

      {versions.length > 1 && (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-bone-600">
          Deltas measured from {first.version} to {last.version}.
        </p>
      )}
    </div>
  );
}
