import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Bot, Play, Wrench } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, statusLabel, statusTone } from "@/components/aegis/StatusBadge";
import { ReliabilityScore, scoreLabel } from "@/components/aegis/ReliabilityScore";
import { MetricBars, TrendChart } from "@/components/aegis/Charts";
import { EvaluationTable } from "@/components/aegis/EvaluationTable";
import { EmptyState, LoadingState } from "@/components/aegis/EmptyState";
import {
  EMPTY_AGENT,
  EMPTY_EVALUATION,
  useAgent,
  useAgentEvaluations,
  useEvaluation,
} from "@/lib/live-data";
import { nextVersionLabel, useRunEvaluation } from "@/lib/use-run-evaluation";
import type { TestResult } from "@/lib/types";

export const Route = createFileRoute("/agents/$agentId")({
  head: () => ({
    meta: [
      { title: "Agent details · Aegis" },
      {
        name: "description",
        content:
          "Agent configuration, evaluation history, generated test scenarios and version history in one view.",
      },
      { property: "og:title", content: "Agent details · Aegis" },
      {
        property: "og:description",
        content: "Inspect an AI agent's configuration and reliability history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentDetails,
});

const riskTone = { low: "info", medium: "warning", high: "danger" } as const;

function AgentDetails() {
  const { agentId } = useParams({ from: "/agents/$agentId" });
  const { data: loadedAgent, loading: agentLoading } = useAgent(agentId);
  const agent = loadedAgent ?? EMPTY_AGENT;
  const { data: agentEvals } = useAgentEvaluations(agentId);
  const latest = agentEvals[0] ?? EMPTY_EVALUATION;
  // The list endpoint returns `tests: []` by design, so reading scenarios off the
  // summary left this tab permanently empty even for a fully completed run. The
  // scenarios only exist on the evaluation detail.
  const { data: latestDetail } = useEvaluation(latest.id || undefined);
  const scenarios: TestResult[] = (latestDetail?.tests ?? []).slice(0, 12);
  const { run, runningAgentId } = useRunEvaluation();
  const startRun = () => run(agentId, nextVersionLabel(agent.versions.map((v) => v.version)));

  // Without this the page first paints "— / Never evaluated / 0" for an agent
  // that has been evaluated many times.
  if (agentLoading && !loadedAgent) {
    return (
      <AppLayout
        title="Agent"
        crumbs={[
          { label: "Aegis", to: "/dashboard" },
          { label: "Agents", to: "/agents" },
          { label: agentId },
        ]}
      >
        <LoadingState rows={5} title="Loading agent…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={agent.name}
      crumbs={[
        { label: "Aegis", to: "/dashboard" },
        { label: "Agents", to: "/agents" },
        { label: agent.name },
      ]}
      actions={
        <Button
          variant="hero"
          size="sm"
          onClick={() => void startRun()}
          disabled={!!runningAgentId}
        >
          <Play className="size-4" /> {runningAgentId ? "Starting…" : "Run Evaluation"}
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
              <Bot className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight">{agent.name}</h1>
                <StatusBadge tone={statusTone(agent.status)}>
                  {statusLabel(agent.status)}
                </StatusBadge>
              </div>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{agent.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
                <span>
                  <span className="text-muted-foreground">Domain · </span>
                  {agent.domain}
                </span>
                <span>
                  <span className="text-muted-foreground">Latest version · </span>
                  <span className="font-mono">{agent.latestVersion}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Last evaluated · </span>
                  <span className="font-mono">{agent.lastEvaluated}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ReliabilityScore score={agent.reliability} size={124} />
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground">Reliability</p>
              <p className="text-sm font-medium">{scoreLabel(agent.reliability)}</p>
              <Button
                variant="hero"
                size="sm"
                className="mt-3"
                onClick={() => void startRun()}
                disabled={!!runningAgentId}
              >
                <Play className="size-3.5" /> {runningAgentId ? "Starting…" : "Run New Evaluation"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="bg-surface">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <p className="text-sm font-medium">System prompt</p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {agent.systemPrompt}
            </pre>
            <p className="mt-6 text-sm font-medium">Reliability trend</p>
            <div className="mt-2">
              <TrendChart
                data={agent.versions.map((v) => ({ date: v.version, score: v.reliability }))}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm font-medium">Metric breakdown</p>
              <div className="mt-4">
                <MetricBars metrics={latest.metrics} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm font-medium">Tools</p>
              <ul className="mt-3 space-y-2.5">
                {agent.tools.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border bg-surface/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-mono text-xs">
                        <Wrench className="size-3.5 text-muted-foreground" />
                        {t.name}
                      </span>
                      <StatusBadge tone={riskTone[t.risk]} dot={false}>
                        {t.risk}
                      </StatusBadge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{t.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evaluations" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {agentEvals.length ? (
              <EvaluationTable rows={agentEvals} />
            ) : (
              <EmptyState
                icon={Play}
                title="No evaluations yet"
                description="Run your first evaluation to generate a reliability report for this agent."
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="scenarios" className="mt-4">
          {scenarios.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No scenarios yet"
              description="Scenarios appear once this agent has a completed evaluation."
            />
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {scenarios.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] text-muted-foreground">{s.scenarioId}</p>
                  <StatusBadge tone={statusTone(s.status)}>{statusLabel(s.status)}</StatusBadge>
                </div>
                <p className="mt-1.5 text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.category}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="versions" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Version</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium">Reliability</th>
                  <th className="px-4 py-2.5 font-medium">Pass rate</th>
                  <th className="px-4 py-2.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...agent.versions].reverse().map((v) => (
                  <tr
                    key={v.version}
                    className="border-b border-border/60 last:border-0 hover:bg-surface/70"
                  >
                    <td className="px-4 py-3 font-mono">{v.version}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {v.createdAt}
                    </td>
                    <td className="px-4 py-3 font-mono">{v.reliability}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{v.passRate}%</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{v.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
