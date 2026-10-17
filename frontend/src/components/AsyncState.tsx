import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { buttonSecondary } from '@/lib/ui';

/**
 * Call sites pass shouting labels ("Nothing evaluated yet"). Messages the reader
 * has to act on are plain sentences, so fold an all-caps label to sentence case.
 */
function plain(text: string): string {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 4 || letters !== letters.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function LoadingState({ label = 'LOADING' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-4 py-16">
      <motion.div
        className="h-8 w-8 border border-signal-500/40 border-t-signal-400"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="text-sm text-bone-300">{plain(label)}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 border border-fault-500/40 bg-fault-500/5 px-6 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-fault-400" strokeWidth={1.5} aria-hidden />
      <p className="font-display text-lg font-semibold text-fault-300">Could not load this</p>
      <p className="max-w-md text-sm text-bone-300">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${buttonSecondary} mt-2`}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-bone-600/40 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-bone-100">{plain(title)}</p>
      {hint && <p className="max-w-md text-sm leading-relaxed text-bone-300">{hint}</p>}
      {action}
    </div>
  );
}

/**
 * The three states in one place.
 *
 * Every screen repeated the same `loading ? … : error ? … : children` ladder, and
 * the ones that got it slightly wrong rendered a chart against undefined data for
 * one frame. Wrapping it means a screen cannot forget a state.
 */
export function AsyncBoundary({
  loading,
  error,
  onRetry,
  label,
  children,
}: {
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  if (loading) return <LoadingState label={label} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  return <>{children}</>;
}
