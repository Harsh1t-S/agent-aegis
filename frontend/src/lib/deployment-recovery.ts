const RELOAD_MARKER = 'aegis.preload-reload-at';
const RELOAD_COOLDOWN_MS = 15_000;

type RecoveryTarget = {
  addEventListener(type: string, listener: EventListener): void;
  location: { reload(): void };
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
};

/**
 * Recover when an already-open tab requests a lazy chunk from an older deploy.
 * Vite emits this event before surfacing the failed import to React.
 */
export function installDeploymentRecovery(
  target: RecoveryTarget = window,
  now: () => number = Date.now,
) {
  target.addEventListener('vite:preloadError', ((event: Event) => {
    const current = now();
    try {
      const previous = Number(target.sessionStorage.getItem(RELOAD_MARKER) ?? 0);
      if (Number.isFinite(previous) && current - previous < RELOAD_COOLDOWN_MS) return;
      target.sessionStorage.setItem(RELOAD_MARKER, String(current));
    } catch {
      // Let React's error boundary render a manual recovery action when
      // session storage is unavailable rather than risking a reload loop.
      return;
    }

    event.preventDefault();
    target.location.reload();
  }) as EventListener);
}

