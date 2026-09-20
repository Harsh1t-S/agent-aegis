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
  TestRunDetail,
  VersionDiff,
  Bootstrap,
  Workspace,
  WorkspaceDetail,
  WorkspaceMember,
  WorkspaceInvitation,
  BillingSummary,
  WorkspaceApiKey,
  ReportShare,
  AuditPage,
  ReviewDecision,
} from '@/types';
import { accessToken, activeWorkspace } from '@/lib/session';

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
    const token = await accessToken();
    const workspace = activeWorkspace();
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(workspace ? { 'X-Workspace-ID': workspace } : {}),
        ...(init?.headers ?? {}) },
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
      .then((body) => {
        if (typeof body?.detail === 'string') return body.detail;
        if (Array.isArray(body?.detail)) {
          return body.detail.map((item: { loc?: string[]; msg?: string }) =>
            `${(item.loc ?? []).filter((part) => part !== 'body').join('.')}: ${item.msg ?? 'Invalid value'}`,
          ).join('; ');
        }
        return null;
      })
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
  connection?: { mode: 'simulation' | 'connected'; url?: string; bearerToken?: string };
}

export interface AgentPatch {
  name?: string;
  description?: string;
  systemPrompt?: string;
  tools?: ToolDraft[];
  connection?: { mode: 'simulation' | 'connected'; url?: string; bearerToken?: string };
}

export interface EvaluateOptions {
  versionLabel?: string;
  perCategory?: number;
  adversarial?: boolean;
  adapter?: 'behavioral' | 'llm' | 'http';
  traits?: string[];
  url?: string;
  scenarios?: ScenarioContractDraft[];
}

export interface ScenarioContractDraft {
  name: string;
  category: 'realistic' | 'edge' | 'adversarial' | 'ambiguous';
  subtype: string;
  initialPrompt: string;
  expectedBehavior: Record<string, unknown>;
  difficulty: number;
  injectedContent: Record<string, unknown>;
}

export const api = {
  publicConfig: () => request<{
    authRequired: boolean;
    billingProvider: string | null;
    checkoutAvailable: boolean;
    plans: BillingSummary['plans'];
  }>('/public/config'),
  bootstrap: () => request<Bootstrap>('/bootstrap', { method: 'POST' }),
  workspaces: () => request<Workspace[]>('/workspaces'),
  workspace: () => request<WorkspaceDetail>('/workspace'),
  createWorkspace: (name: string) =>
    request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
  updateWorkspaceSettings: (settings: Partial<Workspace['settings']>) =>
    request<Workspace['settings']>('/workspace/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),
  deleteWorkspace: (confirmation: string) => request<void>('/workspace', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation }),
  }),
  members: () => request<WorkspaceMember[]>('/members'),
  updateMemberRole: (userId: string, role: 'admin' | 'member' | 'viewer') =>
    request<{ id: string; role: string }>(`/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (userId: string) =>
    request<void>(`/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  invite: (email: string, role: 'admin' | 'member' | 'viewer') =>
    request<{ id: string; inviteUrl: string; delivery: string }>('/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  invitations: () => request<WorkspaceInvitation[]>('/invitations'),
  revokeInvitation: (id: string) =>
    request<void>(`/invitations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  acceptInvite: (token: string) =>
    request<{ accepted: boolean; workspaceId: string | null }>(
      `/invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST' },
    ),
  apiKeys: () => request<WorkspaceApiKey[]>('/api-keys'),
  createApiKey: (name: string, scopes: string[], expiresInDays?: number) =>
    request<WorkspaceApiKey & { key: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, scopes, ...(expiresInDays ? { expiresInDays } : {}) }),
    }),
  revokeApiKey: (id: string) => request<void>(`/api-keys/${id}`, { method: 'DELETE' }),
  audit: (cursor?: string) =>
    request<AuditPage>(`/audit${cursor ? `?before=${encodeURIComponent(cursor)}` : ''}`),
  billing: () => request<BillingSummary>('/billing'),
  checkout: (plan: 'starter' | 'team') =>
    request<{ orderId: string; amount: number; currency: string; keyId: string; name: string; description: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
  verifyPayment: (plan: 'starter' | 'team', payment: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => request<{ verified: boolean; plan: string; status: string }>('/billing/verify', {
    method: 'POST',
    body: JSON.stringify({
      plan,
      orderId: payment.razorpay_order_id,
      paymentId: payment.razorpay_payment_id,
      signature: payment.razorpay_signature,
    }),
  }),
  billingPortal: () => request<{ url: string }>('/billing/portal', { method: 'POST' }),
  dashboard: () => request<DashboardSummary>('/dashboard'),
  scoring: () => request<ScoringContract>('/scoring'),

  agents: (limit?: number, offset = 0) => request<Agent[]>(
    limit === undefined ? '/agents' : `/agents?limit=${limit}&offset=${offset}`,
  ),
  agent: (id: string) => request<Agent>(`/agents/${id}`),
  createAgent: (draft: AgentDraft) =>
    request<Agent>('/agents', { method: 'POST', body: JSON.stringify(draft) }),
  updateAgent: (id: string, patch: AgentPatch) =>
    request<Agent>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAgent: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),
  previewSuite: (id: string, options: { perCategory: number; adversarial: boolean; seed?: number }) =>
    request<{
      agentId: string;
      seed: number;
      generatorVersion: string;
      estimatedCredits: number;
      categories: ScenarioContractDraft['category'][];
      scenarios: Array<ScenarioContractDraft & { fingerprint: string }>;
    }>(`/agents/${id}/suite-preview`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),

  evaluations: (limit?: number, offset = 0) => request<Evaluation[]>(
    limit === undefined ? '/evaluations' : `/evaluations?limit=${limit}&offset=${offset}`,
  ),
  evaluation: (id: string) => request<Evaluation>(`/evaluations/${id}`),
  reportShares: (id: string) =>
    request<ReportShare[]>(`/evaluations/${id}/shares`),
  createReportShare: (id: string, expiresInDays = 7) =>
    request<ReportShare & { path: string }>(`/evaluations/${id}/shares`, {
      method: 'POST',
      body: JSON.stringify({ expiresInDays }),
    }),
  revokeReportShare: (id: string) =>
    request<void>(`/report-shares/${id}`, { method: 'DELETE' }),
  sharedReport: (token: string) => request<{
    share: { expiresAt: string };
    evaluation: Evaluation;
  }>(`/shared-reports/${encodeURIComponent(token)}`),
  testRun: (evaluationId: string, runId: string) =>
    request<TestRunDetail>(`/evaluations/${evaluationId}/tests/${runId}`),
  progress: (id: string) => request<EvaluationProgressPayload>(`/evaluations/${id}/progress`),

  evaluate: (agentId: string, options: EvaluateOptions = {}) =>
    request<CreatedEvaluation>(`/agents/${agentId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({
        versionLabel: options.versionLabel ?? 'v1',
        perCategory: options.perCategory ?? 3,
        adversarial: options.adversarial ?? true,
        adapter: options.adapter ?? 'behavioral',
        idempotencyKey: crypto.randomUUID(),
        ...(options.url ? { url: options.url } : {}),
        ...(options.traits ? { traits: options.traits } : {}),
        ...(options.scenarios ? { scenarios: options.scenarios } : {}),
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

  cancelEvaluation: (evaluationId: string) =>
    request<{ evaluationId: string; canceled: number; runningCancellationRequested: number }>(
      `/evaluations/${evaluationId}/cancel`,
      { method: 'POST' },
    ),

  reviewFinding: (
    runId: string,
    decision: ReviewDecision,
    note = '',
  ) => request<{ testRunId: string; decision: ReviewDecision; note: string; updatedAt: string }>(
    `/test-runs/${runId}/review`,
    { method: 'PUT', body: JSON.stringify({ decision, note }) },
  ),

  reviewedBenchmark: () => request<{
    schemaVersion: string;
    exportedAt: string;
    workspaceId: string;
    records: Array<{
      testRunId: string;
      evaluationId: string;
      scenarioFingerprint: string;
      category: string;
      predictedIssue: boolean;
      humanIssue: boolean;
      reviewDecision: ReviewDecision;
      findingTypes: string[];
      highestSeverity: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }>('/benchmark/reviews'),

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
