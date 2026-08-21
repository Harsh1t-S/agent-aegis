import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Agent } from '@/types';
import { agentStatusLabel, agentStatusTone, formatDate, scoreOrDash } from '@/lib/format';
import { ArrowRight } from 'lucide-react';

export function AgentModule({ agent, index }: { agent: Agent; index: number }) {
  const latest = agent.versions[agent.versions.length - 1];
  const hasRun = agent.status !== 'never-run' && Boolean(latest);
  const criticalFailures = latest
    ? Object.entries(latest.failures ?? {})
        .filter(([category]) => category === 'Unsafe Action' || category === 'Hallucination')
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  return (
    <Link to={`/app/agents/${agent.id}`} className="group block">
      <motion.div
        className="relative flex h-full min-w-0 flex-col border border-bone-600/20 bg-ink-850/50 p-5 sm:p-6 transition-all duration-300 hover:border-violet-500/40 hover:bg-ink-800/50"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.5 }}
      >
        <div className="flex items-start justify-between">
          <span className="font-mono text-3xl font-bold text-bone-600">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className={`tech-label ${agentStatusTone[agent.status]}`}>
            {agentStatusLabel[agent.status]}
          </span>
        </div>

        <h3 className="mt-4 break-words font-display text-lg font-semibold tracking-tight text-bone-50 sm:text-xl">
          {agent.name}
        </h3>
        <p className="mt-1 text-sm text-bone-400">{agent.domain}</p>

        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-bone-600/20 pt-4 sm:gap-4">
          <div>
            <span className="tech-label block text-[9px] tracking-[0.12em] text-bone-600 sm:text-[11px] sm:tracking-[0.25em]">
              RELIABILITY
            </span>
            <div className="mt-1 font-mono text-xl font-bold text-bone-50 sm:text-2xl">
              {scoreOrDash(agent.reliability, hasRun)}
            </div>
          </div>
          <div>
            <span className="tech-label block text-[9px] tracking-[0.12em] text-bone-600 sm:text-[11px] sm:tracking-[0.25em]">
              VERSION
            </span>
            <div className="mt-1 truncate font-mono text-base text-bone-200 sm:text-lg">
              {agent.latestVersion}
            </div>
          </div>
          <div>
            <span className="tech-label block text-[9px] tracking-[0.12em] text-bone-600 sm:text-[11px] sm:tracking-[0.25em]">
              PASS RATE
            </span>
            <div className="mt-1 font-mono text-base text-bone-200 sm:text-lg">
              {hasRun ? `${latest.passRate.toFixed(0)}%` : '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="tech-label min-w-0 break-words text-bone-600">
            {hasRun
              ? `${criticalFailures} critical-class findings · ${formatDate(agent.lastEvaluated)}`
              : `${agent.tools.length} tools · not yet evaluated`}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
            VIEW <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
