import { motion } from 'framer-motion';
import type { AgentVersion, ScenarioDelta, VersionDiff } from '@/types';
import { deltaTone, signed } from '@/lib/format';
import { ScrollReveal } from './ScrollReveal';
import { SystemLabel } from './SystemLabel';

interface VersionBattleProps {
  left: AgentVersion;
  right: AgentVersion;
  /** The server-side scenario diff. Client-side diffing cannot see regressions. */
  diff?: VersionDiff;
  diffError?: string;
}

const metrics: { key: keyof AgentVersion['metrics']; label: string }[] = [
  { key: 'taskSuccess', label: 'TASK SUCCESS' },
  { key: 'toolAccuracy', label: 'TOOL ACCURACY' },
  { key: 'safety', label: 'SAFETY' },
  { key: 'consistency', label: 'CONSISTENCY' },
  { key: 'groundedness', label: 'GROUNDEDNESS' },
];

function ScenarioList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: string;
  items: ScenarioDelta[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <SystemLabel className={tone}>
        {title} — {items.length}
      </SystemLabel>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={`${title}-${item.scenario_id}`}
            className="flex flex-wrap items-center justify-between gap-2 border border-bone-600/20 bg-ink-850/40 px-4 py-3"
          >
            <span className="min-w-0 break-words text-sm text-bone-200">{item.scenario}</span>
            <span className="min-w-0 break-words font-mono text-[11px] text-bone-400">
              {item.from} → <span className={tone}>{item.to}</span>
              {item.failure_types.length > 0 && (
                <span className="ml-2 text-bone-600">{item.failure_types.join(', ')}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VersionBattle({ left, right, diff, diffError }: VersionBattleProps) {
  const scoreDelta = right.reliability - left.reliability;
  const categories = Array.from(
    new Set([...Object.keys(left.failures ?? {}), ...Object.keys(right.failures ?? {})]),
  ).sort();

  return (
    <div className="space-y-8">
      {/* Reliability */}
      <div className="grid grid-cols-1 items-center gap-6 sm:gap-8 md:grid-cols-3">
        <ScrollReveal className="text-center">
          <span className="tech-label text-bone-500">{left.version}</span>
          <motion.div
            className="massive text-5xl text-bone-50 sm:text-6xl md:text-7xl"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {left.reliability.toFixed(1)}
          </motion.div>
        </ScrollReveal>

        <ScrollReveal delay={0.15} className="text-center">
          <div className="font-display text-4xl font-bold text-bone-600">VS</div>
          <div className={`mt-2 font-mono text-sm ${deltaTone(scoreDelta)}`}>
            {signed(scoreDelta)} pts
          </div>
          {diff && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-bone-600">
              {diff.shared_scenarios} shared scenarios
            </div>
          )}
        </ScrollReveal>

        <ScrollReveal delay={0.3} className="text-center">
          <span className="tech-label text-violet-400">{right.version}</span>
          <motion.div
            className="massive text-5xl text-violet-400 sm:text-6xl md:text-7xl"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {right.reliability.toFixed(1)}
          </motion.div>
        </ScrollReveal>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((m, i) => {
          const l = left.metrics[m.key];
          const r = right.metrics[m.key];
          const delta = r - l;

          return (
            <ScrollReveal key={m.key} delay={i * 0.08}>
              <div className="min-w-0 border border-bone-600/20 bg-ink-850/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <SystemLabel>{m.label}</SystemLabel>
                  <span className={`font-mono text-xs font-semibold ${deltaTone(delta)}`}>
                    {l.toFixed(1)}% → {r.toFixed(1)}% ({signed(delta)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-2 flex-1 bg-bone-600/20">
                    <motion.div
                      className="absolute right-0 top-0 h-2 bg-bone-400"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.max(0, Math.min(100, l))}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.08 }}
                    />
                  </div>
                  <div className="relative h-2 flex-1 bg-bone-600/20">
                    <motion.div
                      className="absolute left-0 top-0 h-2"
                      style={{ background: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#7a7a86' }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.max(0, Math.min(100, r))}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.08 + 0.15 }}
                    />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Failure counts, straight off each version */}
      {categories.length > 0 && (
        <ScrollReveal delay={0.2}>
          <div className="min-w-0 border border-bone-600/20 bg-ink-850/40 p-4 sm:p-5">
            <SystemLabel>FAILURE COUNTS BY CLASS</SystemLabel>
            <div className="mt-4 space-y-3">
              {categories.map((category) => {
                const l = left.failures?.[category] ?? 0;
                const r = right.failures?.[category] ?? 0;
                // Fewer failures is better, so the sign is inverted for tone.
                const tone = r < l ? 'text-flux-400' : r > l ? 'text-fault-400' : 'text-bone-400';
                return (
                  <div key={category} className="flex items-center justify-between gap-3">
                    <SystemLabel>{category.toUpperCase()}</SystemLabel>
                    <span className="font-mono text-sm">
                      <span className="text-bone-400">{l}</span>
                      <span className="mx-3 text-bone-600">→</span>
                      <span className={tone}>{r}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-bone-600">
              Counts are per version and are not normalised by scenario count.
            </p>
          </div>
        </ScrollReveal>
      )}

      {/* Server-side scenario diff */}
      <ScrollReveal delay={0.25}>
        <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-4 sm:p-5">
          <SystemLabel>SCENARIO-LEVEL DIFF</SystemLabel>
          {diffError && <p className="mt-3 text-sm text-fault-400">{diffError}</p>}
          {!diffError && !diff && (
            <p className="mt-3 text-sm text-bone-400">Loading the diff…</p>
          )}
          {diff && (
            <div className="mt-4 space-y-6">
              {diff.shared_scenarios === 0 ? (
                <p className="text-sm text-warn-400">
                  These two versions share no scenarios, so no per-scenario comparison is
                  possible. Only the aggregate metrics above are comparable.
                </p>
              ) : (
                <>
                  <ScenarioList title="REGRESSIONS" tone="text-fault-400" items={diff.regressions} />
                  <ScenarioList title="IMPROVEMENTS" tone="text-flux-400" items={diff.improvements} />
                  <ScenarioList title="SOFTENED" tone="text-warn-400" items={diff.softened} />
                  {diff.regressions.length === 0 &&
                    diff.improvements.length === 0 &&
                    diff.softened.length === 0 && (
                      <p className="text-sm text-bone-400">
                        Every one of the {diff.shared_scenarios} shared scenarios reached the same
                        verdict in both versions.
                      </p>
                    )}
                </>
              )}
              <div className="border-t border-bone-600/20 pt-4">
                <SystemLabel className="text-bone-500">VERDICT</SystemLabel>
                <p className="mt-1 font-mono text-sm text-bone-200">{diff.verdict}</p>
              </div>
            </div>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}
