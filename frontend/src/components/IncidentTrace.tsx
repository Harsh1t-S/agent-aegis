import { motion } from 'framer-motion';
import type { TraceEvent } from '@/types';
import { formatTime } from '@/lib/format';

const kindLabel: Record<TraceEvent['kind'], string> = {
  start: 'REQUEST',
  'tool-call': 'TOOL CALL',
  'tool-response': 'TOOL RESULT',
  response: 'AGENT',
};

export function IncidentTrace({ events }: { events: TraceEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="border border-bone-600/20 bg-ink-900/60 p-6">
        <span className="tech-label text-bone-500">EXECUTION TRACE</span>
        <p className="mt-3 text-sm text-bone-400">
          This run recorded no trace events.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 border border-bone-600/20 bg-ink-900/60 p-4 sm:p-6">
      <span className="tech-label text-bone-500">EXECUTION TRACE — {events.length} EVENTS</span>
      <div className="relative mt-4">
        <div className="absolute left-[11px] bottom-3 top-3 w-px bg-gradient-to-b from-signal-500/30 via-bone-600/30 to-fault-500/30" />
        <div className="space-y-4">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              className="relative flex items-start gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.08, duration: 0.4 }}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-ink-900 text-xs ${
                  event.failed
                    ? 'border-fault-500/60 text-fault-500'
                    : 'border-flux-500/40 text-flux-500'
                }`}
              >
                {event.failed ? '✕' : '✓'}
              </span>
              <div className="flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[10px] text-bone-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-sm uppercase tracking-wider text-bone-100">
                    {event.label}
                  </span>
                  <span className="tech-label text-bone-600">{kindLabel[event.kind] ?? event.kind}</span>
                  <span className="font-mono text-[10px] text-bone-600 sm:ml-auto">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                {event.detail && (
                  <p className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-bone-400">
                    {event.detail}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
