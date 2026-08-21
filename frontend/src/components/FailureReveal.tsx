import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FailureBreakdownItem, TestScenario } from '@/types';
import { severityTone } from '@/lib/format';
import { ScrollReveal } from './ScrollReveal';
import { SystemLabel } from './SystemLabel';

interface FailureRevealProps {
  items: FailureBreakdownItem[];
  /** The runs behind the counts. Expanding a category shows these, not a script. */
  tests?: TestScenario[];
  evaluationId?: string;
}

export function FailureReveal({ items, tests = [], evaluationId }: FailureRevealProps) {
  const [active, setActive] = useState<string | null>(null);
  // A category with zero occurrences is not a finding; listing it as one padded
  // every report with six rows regardless of what the run actually detected.
  const detected = items.filter((item) => item.count > 0);

  if (detected.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-bone-400">
        No failure classes were detected in this run.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {detected.map((item, i) => {
        const examples = tests.filter((t) => t.failureType === item.category);
        const open = active === item.category;
        return (
          <ScrollReveal key={item.category} delay={Math.min(i, 5) * 0.08}>
            <div className="border border-bone-600/30 bg-ink-850/50">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-ink-800/50 sm:p-5"
                onClick={() => setActive(open ? null : item.category)}
              >
                <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                  <span className="font-mono text-2xl font-bold text-bone-500">
                    {String(item.count).padStart(2, '0')}
                  </span>
                  <div>
                    <div className="break-words font-display text-base font-semibold text-bone-100 sm:text-lg">
                      {item.category.toUpperCase()}
                    </div>
                    <span className={`tech-label border-l pl-2 ${severityTone[item.severity]}`}>
                      {item.severity} severity
                      {item.criticalCount ? ` · ${item.criticalCount} critical` : ''}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-bone-500">{open ? '−' : '+'}</span>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden border-t border-bone-600/20"
                  >
                    {examples.length === 0 ? (
                      <p className="p-5 text-sm text-bone-400">
                        Counted from this run's classifications. The individual runs are not
                        included in this payload.
                      </p>
                    ) : (
                      <div className="divide-y divide-bone-600/15">
                        {examples.map((test) => (
                          <div key={test.id} className="grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-2">
                            <div>
                              <SystemLabel>{test.title}</SystemLabel>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-bone-200">
                                {test.userPrompt}
                              </p>
                              {test.explanation && (
                                <>
                                  <SystemLabel className="mt-4 block">Why it was flagged</SystemLabel>
                                  <p className="mt-2 text-sm text-bone-400">{test.explanation}</p>
                                </>
                              )}
                            </div>
                            <div className="space-y-3">
                              <div className="border-l-2 border-fault-500/50 pl-3">
                                <SystemLabel className="text-fault-400">Agent response</SystemLabel>
                                <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-bone-300">
                                  {test.agentResponse || '(no final answer)'}
                                </p>
                              </div>
                              <div className="border-l-2 border-flux-500/50 pl-3">
                                <SystemLabel className="text-flux-400">Expected behavior</SystemLabel>
                                <p className="mt-1 font-mono text-xs text-bone-300">
                                  {test.expectedBehavior}
                                </p>
                              </div>
                              {evaluationId && (
                                <Link
                                  to={`/app/evaluations/${evaluationId}/tests/${test.id}`}
                                  className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-wider text-signal-400 hover:text-signal-300"
                                >
                                  FULL TRACE →
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
