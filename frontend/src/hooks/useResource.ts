import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export interface Resource<T> {
  data: T | undefined;
  error: string | undefined;
  /** True only on the first load, so a poll does not blank the screen. */
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
}

/**
 * Fetches once and re-fetches when `deps` change, optionally on an interval.
 *
 * Every screen in this app reads live evaluation data, and every one of them has
 * three states worth distinguishing: never loaded, loaded-and-refreshing, and
 * failed. Collapsing them is how a stale number ends up presented as current.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: { pollMs?: number; enabled?: boolean } = {},
): Resource<T> {
  const { pollMs, enabled = true } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Keeps the effect from depending on a function identity the caller
  // re-creates on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadedRef.current = false;

    const run = async () => {
      if (loadedRef.current) setRefreshing(true);
      try {
        const result = await fetcherRef.current();
        if (cancelled) return;
        setData(result);
        setError(undefined);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void run();
    if (!pollMs) return () => { cancelled = true; };

    const timer = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pollMs, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, loading, refreshing, reload };
}
