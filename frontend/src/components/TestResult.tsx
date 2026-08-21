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
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-ink-800/40"
        onClick={() => setOpen(!open)}
      >
        <span className={`font-mono text-lg ${cfg.color}`}>{cfg.symbol}</span>
        <span className="flex-1 truncate text-sm text-bone-200">{test.title}</span>
        {test.severity && (
          <span className={`hidden border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider md:inline ${severityTone[test.severity]}`}>
            {test.severity}
          </span>
        )}
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-bone-500 md:inline">
          {test.category}
        </span>
        <span className={`tech-label ${cfg.color}`}>{cfg.label}</span>
        <ChevronRight
          className={`h-4 w-4 text-bone-500 transition-transform ${open ? 'rotate-90' : ''}`}
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
                className="font-mono text-[11px] uppercase tracking-wider text-violet-400 hover:text-violet-300"
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
