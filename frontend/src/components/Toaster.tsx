/**
 * Transient confirmations.
 *
 * Several actions in the console — importing a tool schema, saving a draft,
 * copying tools out — finish without changing anything visible on screen. Without
 * an acknowledgement they read as broken buttons, which is the single most common
 * "nothing happens when I click this" complaint. Inline error text still carries
 * anything the user has to act on; this only carries the "that worked" half.
 *
 * Hand-rolled rather than pulled in: one dependency-free file is a smaller risk
 * than a new package, and the styling has to match the console anyway.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  message: string;
  detail?: string;
}

interface ToastApi {
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE = {
  success: { icon: Check, border: 'border-flux-500/45', text: 'text-flux-300' },
  error: { icon: AlertTriangle, border: 'border-fault-500/45', text: 'text-fault-300' },
  info: { icon: Info, border: 'border-signal-500/45', text: 'text-signal-300' },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string, detail?: string) => {
      const id = (next.current += 1);
      // Capped so a loop of failures cannot bury the page it is reporting on.
      setToasts((prev) => [...prev.slice(-2), { id, tone, message, detail }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, detail) => push('success', message, detail),
      error: (message, detail) => push('error', message, detail),
      info: (message, detail) => push('info', message, detail),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Bottom-anchored on phones so it never covers the sticky header, and it
          sits inside the safe area on notched devices. */}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-stretch gap-2 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[22rem]"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = TONE[toast.tone];
            const Icon = tone.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto flex items-start gap-3 border bg-ink-900/95 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur ${tone.border}`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.text}`} strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-mono text-[11px] uppercase tracking-wider text-bone-100">
                    {toast.message}
                  </p>
                  {toast.detail && (
                    <p className="mt-1 break-words text-xs leading-relaxed text-bone-400">
                      {toast.detail}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(toast.id)}
                  className="-m-1 shrink-0 p-1 text-bone-500 transition-colors hover:text-bone-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Never throws when used outside the provider. A missing toast is a missing
 * confirmation; it must not be able to blank the page that was trying to confirm
 * something.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  return (
    api ?? {
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    }
  );
}
