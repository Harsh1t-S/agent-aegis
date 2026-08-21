import { motion } from 'framer-motion';
import { useState } from 'react';
import type { ShowcaseTraceEvent } from '@/types/showcase';

interface ExecutionTraceProps {
  events: ShowcaseTraceEvent[];
  compact?: boolean;
}

const statusColor: Record<ShowcaseTraceEvent['status'], string> = {
  ok: 'text-flux-500 border-flux-500/40',
  fail: 'text-fault-500 border-fault-500/50',
  warn: 'text-warn-500 border-warn-500/40',
};

const statusSymbol: Record<ShowcaseTraceEvent['status'], string> = {
  ok: '✓',
  fail: '✕',
  warn: '⚠',
};

export function ExecutionTrace({ events, compact = false }: ExecutionTraceProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-500/30 via-bone-600/30 to-transparent" />

      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={event.id}>
            <motion.button
              type="button"
              className="group flex w-full items-start gap-3 py-1.5 text-left"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              onClick={() => setSelected(selected === event.id ? null : event.id)}
            >
              <span
                className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[8px] ${statusColor[event.status]}`}
              >
                {statusSymbol[event.status]}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-bone-500">
                    {String(event.id).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-wider text-bone-200 group-hover:text-violet-400 transition-colors">
                    {event.label}
                  </span>
                </div>
                {event.detail && !compact && (
                  <div className="mt-1 font-mono text-[10px] text-bone-400">{event.detail}</div>
                )}
                {selected === event.id && event.detail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 border-l border-violet-500/30 pl-3 font-mono text-[10px] text-bone-300"
                  >
                    {event.detail}
                  </motion.div>
                )}
              </div>
            </motion.button>

            {/* Signal animation between events */}
            {i < events.length - 1 && (
              <motion.div
                className="ml-[7px] h-4 w-px bg-violet-500"
                initial={{ opacity: 0, scaleY: 0 }}
                whileInView={{ opacity: [0, 1, 0], scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.3, duration: 0.6 }}
                style={{ transformOrigin: 'top' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
