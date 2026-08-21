import { motion } from 'framer-motion';
import { SystemLabel } from './SystemLabel';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'LOADING' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <motion.div
        className="h-8 w-8 border border-violet-500/40 border-t-violet-400"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <SystemLabel className="text-bone-500">{label}</SystemLabel>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border border-fault-500/30 bg-fault-500/5 px-6 py-16 text-center">
      <AlertTriangle className="h-6 w-6 text-fault-400" strokeWidth={1.5} />
      <SystemLabel className="text-fault-400">COULD NOT LOAD</SystemLabel>
      <p className="max-w-md text-sm text-bone-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 flex items-center gap-2 border border-bone-600/40 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bone-200 transition-colors hover:border-violet-500/40 hover:text-violet-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> RETRY
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-bone-600/30 px-6 py-20 text-center">
      <SystemLabel className="text-bone-500">{title}</SystemLabel>
      {hint && <p className="max-w-md text-sm text-bone-400">{hint}</p>}
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
