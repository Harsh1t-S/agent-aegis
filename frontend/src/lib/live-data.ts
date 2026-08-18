/**
 * React hooks over the live API.
 *
 * Drop-in replacements for the constants that used to come from `mock-data.ts`:
 * every hook returns the same shape the routes already render, plus `loading` and
 * `error`. Data starts as an empty array rather than undefined, so existing
 * `.map()` and `[0]` access paths stay valid while the first request is in flight.
 *
 * Deliberately dependency-free — the project has no query library, and adding one
 * to fetch six endpoints would be more machinery than the problem needs.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { api, type DashboardStats, type EvaluationProgress } from "./api";
import type { Agent, Evaluation } from "./types";

interface Resource<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useResource<T>(load: () => Promise<T>, initial: T, deps: unknown[] = []): Resource<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Guards against a slow first response overwriting a newer one.
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    let cancelled = false;
    setLoading(true);
    load()
      .then((value) => {
        if (!cancelled && current === generation.current) {
          setData(value);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled && current === generation.current) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled && current === generation.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return { data, loading, error, refresh };
}

/**
 * Type-complete placeholders for the first paint.
 *
 * Routes derive `evaluations[0]` or `getAgent(id)` synchronously at the top of
 * their component. Rather than restructure ten files around a loading branch,
 * these stand in until the first response lands — same shape, zeroed values.
 */
export const EMPTY_METRICS = {
  taskSuccess: 0,
  toolAccuracy: 0,
  safety: 0,
  consistency: 0,
  groundedness: 0,
};

export const EMPTY_EVALUATION: Evaluation = {
  id: "",
  agentId: "",
  agentName: "—",
  version: "—",
  score: 0,
  previousScore: 0,
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  status: "queued",
  date: "",
  metrics: { ...EMPTY_METRICS },
  failureBreakdown: [],
  tests: [],
};

export const EMPTY_AGENT: Agent = {
  id: "",
  name: "—",
  description: "",
  domain: "—",
  systemPrompt: "",
  tools: [],
  latestVersion: "—",
  reliability: 0,
  previousReliability: 0,
  lastEvaluated: "",
  status: "never-run",
  versions: [],
};

const EMPTY_DASHBOARD: DashboardStats = {
  averageReliability: 0,
  reliabilityDelta: 0,
  agentsTested: 0,
  testsExecuted: 0,
  criticalFailures: 0,
  verdict: "No data",
  trend: [],
};

export function useDashboard() {
  return useResource<DashboardStats>(() => api.dashboard(), EMPTY_DASHBOARD);
}

export function useAgents() {
  return useResource<Agent[]>(() => api.agents(), []);
}

export function useAgent(id: string | undefined) {
  return useResource<Agent | null>(
    () => (id ? api.agent(id) : Promise.resolve(null)),
    null,
    [id],
  );
}

export function useEvaluations() {
  return useResource<Evaluation[]>(() => api.evaluations(), []);
}

export function useEvaluation(id: string | undefined) {
  return useResource<Evaluation | null>(
    () => (id ? api.evaluation(id) : Promise.resolve(null)),
    null,
    [id],
  );
}

export function useAgentEvaluations(agentId: string | undefined) {
  const { data, loading, error, refresh } = useEvaluations();
  return {
    data: agentId ? data.filter((evaluation) => evaluation.agentId === agentId) : [],
    loading,
    error,
    refresh,
  };
}

/** Polls while a run is in flight and stops the moment it completes. */
export function useEvaluationProgress(id: string | undefined, intervalMs = 1200) {
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const next = await api.progress(id);
        if (stopped) return;
        setProgress(next);
        setError(null);
        if (next.status !== "completed") timer = setTimeout(poll, intervalMs);
      } catch (cause: unknown) {
        if (stopped) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        timer = setTimeout(poll, intervalMs * 3);
      }
    };

    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, intervalMs]);

  return { progress, error, done: progress?.status === "completed" };
}

export { api } from "./api";
