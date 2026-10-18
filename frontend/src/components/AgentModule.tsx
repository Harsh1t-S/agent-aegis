import { Link } from 'react-router-dom';
import type { Agent } from '@/types';
import { agentStatusLabel, agentStatusTone, domainLabel, formatDate, hasAgentScore, scoreOrDash } from '@/lib/format';
import { ArrowRight } from 'lucide-react';

/** One agent in the list: name and state on top, the three numbers that matter below. */
export function AgentModule({ agent }: { agent: Agent; index?: number }) {
  const latest = agent.versions[agent.versions.length - 1];
  const hasRun = hasAgentScore(agent) && Boolean(latest);
  const criticalFailures = latest
    ? Object.entries(latest.failures ?? {})
        .filter(([category]) => category === 'Unsafe Action' || category === 'Hallucination')
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  return (
    <Link
      to={`/app/agents/${agent.id}`}
      className="group flex h-full min-w-0 flex-col border border-bone-600/30 bg-ink-900 p-4 transition-colors hover:border-signal-500/50 hover:bg-ink-850 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-display text-lg font-semibold leading-snug text-bone-50">
          {agent.name}
        </h3>
        <span className={`shrink-0 text-sm font-medium capitalize ${agentStatusTone[agent.status]}`}>
          {agentStatusLabel[agent.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-bone-400">{domainLabel(agent.domain)}</p>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-bone-600/25 pt-4">
        <div>
          <dt className="text-sm text-bone-300">Reliability</dt>
          <dd className="mt-1 font-mono text-2xl font-semibold text-bone-50">{scoreOrDash(agent.reliability, hasRun)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-bone-300">Version</dt>
          <dd className="mt-1 truncate font-mono text-lg text-bone-100">{agent.latestVersion}</dd>
        </div>
        <div>
          <dt className="text-sm text-bone-300">Pass rate</dt>
          <dd className="mt-1 font-mono text-lg text-bone-100">{hasRun ? `${latest.passRate.toFixed(0)}%` : '—'}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="min-w-0 break-words text-sm text-bone-400">
          {hasRun
            ? `${criticalFailures} critical findings · ${formatDate(agent.lastEvaluated)}`
            : `${agent.tools.length} tools · not run yet`}
        </p>
        <ArrowRight className="h-4 w-4 shrink-0 text-signal-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
