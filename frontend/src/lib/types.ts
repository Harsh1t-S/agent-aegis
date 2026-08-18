export type RiskLevel = "low" | "medium" | "high";
export type TestStatus = "passed" | "failed" | "warning";
export type EvaluationStatus = "completed" | "running" | "queued" | "failed";
export type Severity = "low" | "medium" | "high" | "critical";

export type FailureCategory =
  | "Hallucination"
  | "Goal Drift"
  | "Tool Misuse"
  | "Unsafe Action"
  | "Infinite Loop"
  | "Overconfidence";

export interface Tool {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
}

export interface AgentVersion {
  version: string;
  createdAt: string;
  reliability: number;
  passRate: number;
  notes: string;
  failures: Record<FailureCategory, number>;
  metrics: ReliabilityMetrics;
}

export interface ReliabilityMetrics {
  taskSuccess: number;
  toolAccuracy: number;
  safety: number;
  consistency: number;
  groundedness: number;
}

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
  status: "reliable" | "needs-attention" | "critical" | "never-run";
  versions: AgentVersion[];
}

export interface TraceStep {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  kind: "start" | "reasoning" | "tool-call" | "tool-response" | "response" | "failure";
  failed?: boolean;
}

export interface TestResult {
  id: string;
  scenarioId: string;
  title: string;
  category: string;
  status: TestStatus;
  severity: Severity | null;
  durationMs: number;
  failureType: FailureCategory | null;
  userPrompt: string;
  expectedBehavior: string;
  agentResponse: string;
  explanation: string;
  recommendation: string;
  trace: TraceStep[];
}

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
  metrics: ReliabilityMetrics;
  failureBreakdown: { category: FailureCategory; count: number; severity: Severity }[];
  tests: TestResult[];
}
