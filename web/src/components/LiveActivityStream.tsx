import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * The evaluation log, as reported by the API's progress endpoint.
 *
 * This used to synthesise plausible-looking log lines on a timer. A fabricated
 * activity feed on an evaluation screen is indefensible in this product, so the
 * component now renders only what the server actually sent.
 */
export function LiveActivityStream({ events }: { events: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [events]);

  return (
    <div className="h-64 overflow-y-auto border border-bone-600/20 bg-ink-900/80 p-4 font-mono text-xs">
      {events.length === 0 ? (
        <span className="text-bone-600">Waiting for the first scenario to finish…</span>
      ) : (
        <AnimatePresence initial={false}>
          {events.map((event, i) => {
            const failed = event.includes('FAILED');
            const detection = event.startsWith('  detected');
            return (
              <motion.div
                key={`${i}-${event}`}
                className="flex gap-3 py-0.5"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span className="shrink-0 text-bone-600">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={
                    failed ? 'text-fault-400' : detection ? 'text-warn-400' : 'text-bone-400'
                  }
                >
                  {event}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
