import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TestScenario } from '@/types';
import { severityTone, testStatusTone } from '@/lib/format';
import { ChevronRight } from 'lucide-react';

export function TestResult({ test, evaluationId }: { test: TestScenario; evaluationId: string }) {
  const [open, setOpen] = useState(false);
  const cfg = testStatusTone[test.status];

  return (
    <div className="border border-bone-600/20 bg-ink-850/40">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-ink-800/40 sm:gap-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={`shrink-0 font-mono text-lg ${cfg.color}`}>{cfg.symbol}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-bone-200">{test.title}</span>
          {/* On a phone these three no longer fit beside the title, so they move
              under it instead of being hidden — severity is the whole point of
              the row. */}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
            <span className={`font-mono text-[9px] uppercase tracking-wider ${cfg.color}`}>
              {cfg.label}
            </span>
            {test.severity && (
              <span className={`border px-1.5 font-mono text-[9px] uppercase tracking-wider ${severityTone[test.severity]}`}>
                {test.severity}
              </span>
            )}
            <span className="font-mono text-[9px] uppercase tracking-wider text-bone-500">
              {test.category}
            </span>
          </span>
        </span>
        {test.severity && (
          <span className={`hidden shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider md:inline ${severityTone[test.severity]}`}>
            {test.severity}
          </span>
        )}
        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wider text-bone-500 md:inline">
          {test.category}
        </span>
        <span className={`hidden shrink-0 sm:inline ${cfg.color} tech-label`}>{cfg.label}</span>
        <ChevronRight
          className={`h-5 w-5 shrink-0 text-bone-500 transition-transform ${open ? 'rotate-90' : ''}`}
        />
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
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <span className="tech-label text-bone-600">SCENARIO</span>
                <p className="mt-1 whitespace-pre-wrap text-sm text-bone-200">{test.userPrompt}</p>
                <span className="tech-label mt-3 block text-flux-400">EXPECTED</span>
                <p className="mt-1 text-sm text-bone-400">{test.expectedBehavior}</p>
              </div>
              <div>
                <span className="tech-label text-bone-600">AGENT RESPONSE</span>
                <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-bone-300">
                  {test.agentResponse || <span className="text-bone-600">(no final answer)</span>}
                </p>
                {test.failureType && (
                  <span className="tech-label mt-3 block text-fault-400">
                    FAILURE: {test.failureType.toUpperCase()}
                  </span>
                )}
                {test.explanation && (
                  <p className="mt-1 text-xs text-bone-400">{test.explanation}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bone-600/20 p-4">
              <span className="font-mono text-[10px] text-bone-600">
                {test.durationMs} ms · {test.trace.length} trace events
              </span>
              <Link
                to={`/app/evaluations/${evaluationId}/tests/${test.id}`}
                className="flex min-h-11 items-center font-mono text-[11px] uppercase tracking-wider text-signal-400 hover:text-signal-300"
              >
                VIEW FULL INCIDENT REPORT →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
