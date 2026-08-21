import type {
  Agent,
  CiGate,
  CreatedEvaluation,
  DashboardSummary,
  Evaluation,
  EvaluationProgressPayload,
  GuardrailReport,
  RiskLevel,
  ScoringContract,
  VersionDiff,
} from '@/types';

/**
 * Where the API lives.
 *
 * The default is the same-origin `/api` prefix: in development Vite proxies it
 * (see vite.config.ts) and in production the host rewrites it (see vercel.json).
 * Going through the origin rather than straight at the API host keeps the browser
 * out of CORS preflight entirely, which is what broke non-GET calls before.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    // A network-level failure is not a 500 and should not be reported as one —
    // the difference tells the user whether to retry or to look at the service.
    throw new ApiError('Could not reach the evaluation API.', 0);
  }

  if (!response.ok) {
    // FastAPI puts the human-readable reason in `detail`; falling back to the
    // status text loses things like "An agent named 'x' already exists."
    const detail = await response
      .json()
      .then((body) => (typeof body?.detail === 'string' ? body.detail : null))
      .catch(() => null);
    throw new ApiError(detail ?? `${response.status} ${response.statusText}`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ToolDraft {
  name: string;
  description: string;
  risk: RiskLevel;
  /**
   * The JSON-Schema block off a real tool definition. Dropping it cost every
   * generated scenario its argument shape, so a call like
   * issue_refund(order_id, amount) was tested as issue_refund().
   */
  parameters?: Record<string, unknown>;
}

export interface AgentDraft {
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDraft[];
}

export interface AgentPatch {
  name?: string;
  description?: string;
  systemPrompt?: string;
  tools?: ToolDraft[];
}

export interface EvaluateOptions {
  versionLabel?: string;
  perCategory?: number;
  adversarial?: boolean;
  adapter?: 'behavioral' | 'llm';
  traits?: string[];
}

export const api = {
  dashboard: () => request<DashboardSummary>('/dashboard'),
  scoring: () => request<ScoringContract>('/scoring'),

  agents: () => request<Agent[]>('/agents'),
  agent: (id: string) => request<Agent>(`/agents/${id}`),
  createAgent: (draft: AgentDraft) =>
    request<Agent>('/agents', { method: 'POST', body: JSON.stringify(draft) }),
  updateAgent: (id: string, patch: AgentPatch) =>
    request<Agent>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAgent: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),

  evaluations: () => request<Evaluation[]>('/evaluations'),
  evaluation: (id: string) => request<Evaluation>(`/evaluations/${id}`),
  progress: (id: string) => request<EvaluationProgressPayload>(`/evaluations/${id}/progress`),

  evaluate: (agentId: string, options: EvaluateOptions = {}) =>
    request<CreatedEvaluation>(`/agents/${agentId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({
        versionLabel: options.versionLabel ?? 'v1',
        perCategory: options.perCategory ?? 3,
        adversarial: options.adversarial ?? true,
        adapter: options.adapter ?? 'behavioral',
        ...(options.traits ? { traits: options.traits } : {}),
      }),
    }),

  ciGate: (evaluationId: string) =>
    request<CiGate>(`/evaluations/${evaluationId}/ci-gate`),

  guardrail: (evaluationId: string) =>
    request<GuardrailReport>(`/evaluations/${evaluationId}/guardrail`),

  startGuardrail: (evaluationId: string) =>
    request<{ evaluationId: string; queued: number }>(
      `/evaluations/${evaluationId}/guardrail`,
      { method: 'POST' },
    ),

  rerunTest: (runId: string) =>
    request<{ runId: string; replayedFrom: string; evaluationId: string; status: string }>(
      `/test-runs/${runId}/rerun`,
      { method: 'POST' },
    ),

  compare: (olderVersionId: string, newerVersionId: string) =>
    request<VersionDiff>(`/versions/${olderVersionId}/compare/${newerVersionId}`),

  /**
   * Re-grade every stored trace in an evaluation with the current detectors.
   * No model is called, so an improved detector can be applied to history for
   * free — and a report graded by an older evaluator can be brought up to date
   * without inventing new evidence.
   */
  reanalyze: (evaluationId: string) =>
    request<{ replayed: number; changed: number; detectorVersion: string | null }>(
      `/evaluations/${evaluationId}/reanalyze`,
      { method: 'POST' },
    ),
};
