/**
 * Live API client for the Aegis evaluator backend.
 *
 * The backend emits exactly the shapes in `./types`, so nothing is reshaped here —
 * this file is only transport plus error handling. Point it somewhere else with
 * `VITE_API_BASE`; with no value set it calls the same origin, which is what the
 * bundled console does.
 */
import type { Agent, Evaluation } from "./types";

export const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.["VITE_API_BASE"] ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : text || response.statusText;
    throw new ApiError(detail, response.status);
  }
  return body as T;
}

export interface DashboardStats {
  averageReliability: number;
  reliabilityDelta: number;
  agentsTested: number;
  testsExecuted: number;
  criticalFailures: number;
  verdict: string;
  trend: { date: string; score: number }[];
}

export interface EvaluationProgress {
  evaluationId: string;
  agentName: string;
  version: string;
  total: number;
  completed: number;
  status: "running" | "completed";
  events: string[];
}

export interface NewAgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  tools: { name: string; description?: string; risk?: string }[];
}

export interface EvaluateInput {
  versionLabel?: string;
  traits?: string[];
  perCategory?: number;
  seed?: number;
  adapter?: "behavioral" | "http";
  adversarial?: boolean;
  url?: string;
}

export const api = {
  dashboard: () => request<DashboardStats>("/api/dashboard"),
  agents: () => request<Agent[]>("/api/agents"),
  agent: (id: string) => request<Agent>(`/api/agents/${id}`),
  createAgent: (body: NewAgentInput) =>
    request<Agent>("/api/agents", { method: "POST", body: JSON.stringify(body) }),
  deleteAgent: (id: string) => request<null>(`/api/agents/${id}`, { method: "DELETE" }),
  evaluations: () => request<Evaluation[]>("/api/evaluations"),
  evaluation: (id: string) => request<Evaluation>(`/api/evaluations/${id}`),
  progress: (id: string) => request<EvaluationProgress>(`/api/evaluations/${id}/progress`),
  reanalyze: (id: string) =>
    request<{ replayed: number; changed: number; detectorVersion: string | null }>(
      `/api/evaluations/${id}/reanalyze`, { method: "POST" }),
  evaluate: (agentId: string, body: EvaluateInput = {}) =>
    request<{ evaluationId: string; agentId: string; total: number; version: string }>(
      `/api/agents/${agentId}/evaluate`,
      { method: "POST", body: JSON.stringify(body) },
    ),
};
