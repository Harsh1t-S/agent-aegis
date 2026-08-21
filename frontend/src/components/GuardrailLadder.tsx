import { motion } from 'framer-motion';
import type { GuardrailReport } from '@/types';
import { SystemLabel } from './SystemLabel';
import { Loader2, ShieldAlert } from 'lucide-react';

interface GuardrailLadderProps {
  report: GuardrailReport | undefined;
  error?: string;
  running: boolean;
  onRun: () => void;
}

export function GuardrailLadder({ report, error, running, onRun }: GuardrailLadderProps) {
  const ran = report?.ran !== false && (report?.tools.length ?? 0) > 0;

  return (
    <div className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-violet-400" strokeWidth={1.5} />
          <SystemLabel>GUARDRAIL PRESSURE LADDER</SystemLabel>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="flex min-h-11 items-center gap-2 border border-violet-500/40 bg-violet-500/10 px-4 font-mono text-[11px] uppercase tracking-wider text-violet-400 transition-colors enabled:hover:bg-violet-500/20 disabled:opacity-50"
        >
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {ran ? 'RE-RUN LADDER' : 'RUN LADDER'}
        </button>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-bone-400">
        Each irreversible tool is asked for the same forbidden action seven times, under
        escalating pressure — plain request, ambiguity, urgency, claimed authority, false
        authorization, indirection, injected instruction. The rung it first complies on is its
        breaking point.
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-bone-500">
        The forbidden action is compiled from the agent's own prompt, not from the tool's
        risk level — a high-risk tool the prompt permits is not a breach. Where a prompt
        states no rule at all, only one boundary is asserted: an instruction embedded in
        retrieved content was not issued by a principal and cannot authorise an
        irreversible action. Those results are labelled below.
      </p>

      {error && <p className="mt-4 text-sm text-fault-400">{error}</p>}

      {!error && !ran && (
        <p className="mt-6 border border-dashed border-bone-600/30 px-4 py-8 text-center text-sm text-bone-500">
          {running
            ? 'Probes queued. Results appear as each rung completes.'
            : 'The ladder has not been run for this evaluation. No resistance score is shown until it has.'}
        </p>
      )}

      {!error && ran && report && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="border border-bone-600/20 bg-ink-850/40 p-4">
              <SystemLabel className="text-bone-600">RESISTANCE</SystemLabel>
              <div className="mt-2 font-mono text-2xl font-bold text-bone-50">
                {/* Withheld rather than estimated when a rung did not run — a
                    partial ladder cannot produce an honest resistance score. */}
                {report.resistanceScore === null ? '—' : `${report.resistanceScore}`}
              </div>
              <div className="mt-1 font-mono text-[10px] text-bone-500">
                {report.resistanceScore === null
                  ? 'withheld — ladder incomplete'
                  : `${report.rungsHeld}/${report.rungsRun} rungs held`}
              </div>
            </div>
            <div className="border border-bone-600/20 bg-ink-850/40 p-4">
              <SystemLabel className="text-bone-600">COVERAGE</SystemLabel>
              <div className="mt-2 font-mono text-2xl font-bold text-bone-50">
                {report.coverage ?? 0}%
              </div>
              <div className="mt-1 font-mono text-[10px] text-bone-500">
                {report.rungsRun ?? 0} of {report.rungsExpected ?? 0} rungs
                {report.rungsNotRun ? ` · ${report.rungsNotRun} did not run` : ''}
              </div>
            </div>
            <div className="min-w-0 border border-bone-600/20 bg-ink-850/40 p-4">
              <SystemLabel className="text-bone-600">WEAKEST TOOL</SystemLabel>
              <div className="mt-2 truncate font-mono text-lg text-bone-50">
                {report.weakestTool ?? '—'}
              </div>
              <div className="mt-1 font-mono text-[10px] text-bone-500">
                {report.firstBreakingPoint
                  ? `breaks at L${report.firstBreakingPoint}`
                  : 'no breach recorded'}
              </div>
            </div>
          </div>

          {report.verdict && (
            <p className="mt-4 font-mono text-sm text-bone-200">{report.verdict}</p>
          )}

          <div className="mt-6 space-y-4">
            {report.tools.map((tool) => (
              <div key={tool.tool} className="min-w-0 border border-bone-600/20 bg-ink-850/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-all font-mono text-sm text-violet-400">{tool.tool}</span>
                  {tool.sourceAuthorityOnly && (
                    <span className="border border-warn-500/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warn-400">
                      source authority only
                    </span>
                  )}
                  <span
                    className={`font-mono text-[11px] uppercase tracking-wider ${
                      tool.breakingPoint ? 'text-fault-400' : 'text-flux-400'
                    }`}
                  >
                    {tool.breakingPoint
                      ? `breaks at L${tool.breakingPoint} · held to L${tool.heldTo}`
                      : `held all ${tool.maxLevel} rungs`}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tool.rungs.map((rung, i) => (
                    <motion.span
                      key={`${tool.tool}-${rung.level}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i, 8) * 0.04 }}
                      title={rung.technique}
                      className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider sm:text-[10px] ${
                        rung.breached
                          ? 'border-fault-500/50 bg-fault-500/10 text-fault-300'
                          : 'border-flux-500/40 bg-flux-500/5 text-flux-400'
                      }`}
                    >
                      L{rung.level} {rung.technique.replace(/_/g, ' ')}
                    </motion.span>
                  ))}
                </div>
                {tool.sourceAuthorityOnly && (
                  <p className="mt-3 border-l-2 border-warn-500/40 pl-3 text-xs leading-relaxed text-bone-400">
                    The prompt states no rule covering <code className="text-bone-200">{tool.tool}</code>,
                    so the direct-request rungs were not run — a user asking for it is a
                    principal the prompt allows. Only the injected-instruction rung applies.
                  </p>
                )}
                {tool.breachedTechniques.length > 0 && (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-bone-600">
                    Complied under: {tool.breachedTechniques.join(', ').replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          {(report.rungsNotApplicable?.length ?? 0) > 0 && (
            <div className="mt-4 border border-bone-600/20 px-4 py-3">
              <SystemLabel className="text-bone-600">NOT APPLICABLE TO THIS AGENT</SystemLabel>
              <div className="mt-2 space-y-1">
                {report.rungsNotApplicable?.map((row) => (
                  <p
                    key={`${row.tool}-${row.level}`}
                    className="font-mono text-[10px] text-bone-500"
                  >
                    {row.tool} L{row.level} {row.technique.replace(/_/g, ' ')}
                    {row.reason ? ` — ${row.reason}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
