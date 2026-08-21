/**
 * These types mirror the Aegis API payloads field for field.
 *
 * They are deliberately not "nicer" names than the wire format. An adapter layer
 * between the API and the components is one more place the two can silently drift
 * apart, and a dashboard that shows a number the API never sent is the exact
 * failure this product exists to catch.
 */

export type FailureCategory =
  | 'Hallucination'
  | 'Goal Drift'
  | 'Tool Misuse'
  | 'Unsafe Action'
  | 'Infinite Loop'
  | 'Overconfidence';

/** `critical` is the severity that caps a score at 30. It must be representable. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type TestStatus = 'passed' | 'failed' | 'warning';

export type ScenarioCategory = 'realistic' | 'edge' | 'ambiguous' | 'adversarial';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Tool {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
  parameters?: Record<string, unknown>;
}

export interface TraceEvent {
  id: string;
  label: string;
  detail?: string;
  timestamp: string;
  kind: 'start' | 'tool-call' | 'tool-response' | 'response';
  failed: boolean;
}

export interface TestScenario {
  id: string;
  scenarioId: string;
  title: string;
  category: ScenarioCategory;
  status: TestStatus;
  severity?: Severity | null;
  durationMs: number;
  failureType?: FailureCategory | null;
  userPrompt: string;
  expectedBehavior: string;
  agentResponse: string;
  explanation?: string | null;
  recommendation?: string | null;
  trace: TraceEvent[];
}

export interface ReliabilityDimensions {
  taskSuccess: number;
  toolAccuracy: number;
  safety: number;
  consistency: number;
  groundedness: number;
}

export interface FailureBreakdownItem {
  category: FailureCategory;
  count: number;
  severity: Severity;
  criticalCount?: number;
}

export interface CategoryBreakdownItem {
  category: ScenarioCategory;
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  score: number;
}

export interface AgentVersion {
  id: string;
  version: string;
  createdAt: string;
  reliability: number;
  passRate: number;
  notes: string;
  failures: Record<string, number>;
  metrics: ReliabilityDimensions;
}

export type AgentStatus = 'never-run' | 'reliable' | 'needs-attention' | 'critical';

export interface Agent {
  id: string;
  name: string;
  description: string;
  domain: string;
  systemPrompt: string;
  tools: Tool[];
  latestVersion: string;
  reliability: number;
  previousReliability: number;
  lastEvaluated: string;
  status: AgentStatus;
  versions: AgentVersion[];
}

export type EvaluationStatus = 'completed' | 'running' | 'queued';

export interface Evaluation {
  id: string;
  agentId: string;
  agentName: string;
  version: string;
  score: number;
  previousScore: number;
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  status: EvaluationStatus;
  date: string;
  metrics: ReliabilityDimensions;
  failureBreakdown: FailureBreakdownItem[];
  categories?: CategoryBreakdownItem[];
  evaluator?: EvaluationProvenance;
  tests: TestScenario[];
}

export interface EvaluationProgressPayload {
  evaluationId: string;
  agentName: string;
  version: string;
  total: number;
  completed: number;
  status: 'running' | 'completed';
  events: string[];
}

export interface DashboardSummary {
  averageReliability: number;
  reliabilityDelta: number;
  latestVersionDelta: number;
  agentsTested: number;
  verdict: string;
  trend: { date: string; score: number }[];

  /* The population the reliability average is actually computed from: the latest
     run per scenario, guardrail probes excluded. */
  scoredScenarios: number;
  criticalFindings: number;
  evaluations: number;

  /* Everything that ever executed. Rendering these two groups as one row of tiles
     is how "54 reliability / 49 critical failures" came to read as one set of
     runs when it was two. */
  totalRuns: number;
  guardrailProbes: number;
  rerunsAndSuperseded: number;
  allTimeCriticalFindings: number;

  /** @deprecated carries `scoredScenarios`; kept so a cached bundle still renders. */
  testsExecuted: number;
  /** @deprecated carries `criticalFindings`. */
  criticalFailures: number;
}

export interface EvaluatorStamp {
  generator: string;
  guardrail: string;
  detector: string;
  profile: string;
  commit: string;
}

export interface ScoringContract {
  weights: Record<string, number>;
  meanings: Record<string, string>;
  safetyGate: number;
  gates: { atMost: number; when: string }[];
  safetyGateNote: string;
  verdictBands: { atLeast: number; label: string }[];
  /** The evaluator currently deployed, so a stored verdict can be checked against
      the code that claims to have produced it. */
  evaluator?: EvaluatorStamp;
}

/** How an evaluation's stored results relate to the deployed evaluator. */
export interface EvaluationProvenance {
  current: boolean;
  /** True when its scenarios were graded by more than one evaluator. */
  mixed: boolean;
  recorded: EvaluatorStamp | null;
  expected: EvaluatorStamp;
  runsCurrent: number;
  runsTotal: number;
  reason: string;
}

export interface VersionDiff {
  older: { id: string; label: string; score: number };
  newer: { id: string; label: string; score: number };
  score_delta: number;
  verdict: string;
  shared_scenarios: number;
  regressions: ScenarioDelta[];
  softened: ScenarioDelta[];
  improvements: ScenarioDelta[];
  fixes?: ScenarioDelta[];
  metric_deltas: Record<string, number>;
}

export interface ScenarioDelta {
  scenario_id: string;
  scenario: string;
  from: string;
  to: string;
  failure_types: string[];
}

export interface CreatedEvaluation {
  evaluationId: string;
  agentId: string;
  total: number;
  version: string;
}

export interface CiGate {
  evaluationId: string;
  passed: boolean;
  exitCode: number;
  gates: { ok: boolean; check: string }[];
  thresholds: { minScore: number; maxCritical: number; maxFailed: number };
}

export interface GuardrailRung {
  level: number;
  technique: string;
  breached: boolean;
  runId?: string;
}

export interface GuardrailTool {
  tool: string;
  /** null when the tool held every rung the ladder could apply to it. */
  breakingPoint: number | null;
  heldTo: number;
  maxLevel: number;
  breachedTechniques: string[];
  /** Which boundary this ladder asserted: forbid / verify / limit, or
      `source-authority` when the prompt stated nothing to test. */
  policyMode?: string | null;
  policyBasis?: string[];
  /** True when the only rule asserted was that retrieved content cannot authorise
      an irreversible action. A one-rung result must not read as a full clean sheet. */
  sourceAuthorityOnly?: boolean;
  rungs: GuardrailRung[];
}

export interface GuardrailReport {
  ran?: boolean;
  guardrailVersion?: string;
  /** False when a rung did not run; the resistance score is withheld until true. */
  complete?: boolean;
  rungsExpected?: number;
  rungsRun?: number;
  rungsHeld?: number;
  rungsNotRun?: number;
  rungsSkipped?: { tool: string; level: number; technique: string; reason?: string }[];
  rungsNotApplicable?: { tool: string; level: number; technique: string; reason?: string }[];
  coverage?: number;
  resistanceScore: number | null;
  verdict?: string;
  weakestTool?: string | null;
  firstBreakingPoint?: number | null;
  sourceAuthorityOnlyTools?: string[];
  tools: GuardrailTool[];
  ladder: { level: number; technique: string; description: string }[];
}
