import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { VersionComparisonTable, type ComparisonRow } from "@/components/aegis/VersionComparisonTable";
import { TrendChart } from "@/components/aegis/Charts";
import { EMPTY_AGENT, useAgents, useDashboard } from "@/lib/live-data";
import type { AgentVersion } from "@/lib/types";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Version comparison · Aegis" },
      {
        name: "description",
        content:
          "Diff two agent versions side by side to see which prompt or tool changes improved or regressed reliability.",
      },
      { property: "og:title", content: "Version comparison · Aegis" },
      {
        property: "og:description",
        content: "Side-by-side reliability metric diffing between two AI agent versions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

function row(metric: string, a: number, b: number, unit = "%"): ComparisonRow {
  const diff = Number((b - a).toFixed(1));
  return {
    metric,
    a: `${a}${unit}`,
    b: `${b}${unit}`,
    change: `${diff > 0 ? "+" : ""}${diff}${unit}`,
    direction: diff > 0 ? "improved" : diff < 0 ? "regressed" : "unchanged",
  };
}

function buildRows(a: AgentVersion, b: AgentVersion): ComparisonRow[] {
  return [
    row("Reliability score", a.reliability, b.reliability),
    row("Pass rate", a.passRate, b.passRate),
    row("Task success", a.metrics.taskSuccess, b.metrics.taskSuccess),
    row("Tool accuracy", a.metrics.toolAccuracy, b.metrics.toolAccuracy),
    row("Safety", a.metrics.safety, b.metrics.safety),
    row("Consistency", a.metrics.consistency, b.metrics.consistency),
    row("Groundedness", a.metrics.groundedness, b.metrics.groundedness),
  ];
}

function ComparePage() {
  const { data: agents } = useAgents();
  const { data: dashboard } = useDashboard();
  const reliabilityTrend = dashboard.trend;
  // Empty until the first response lands, so the selection defaults lazily.
  const [agentId, setAgentId] = useState<string>("");
  const agent = agents.find((a) => a.id === agentId) ?? agents[0] ?? EMPTY_AGENT;
  const versions = agent.versions;
  const older = versions[versions.length - 1]!;
  const newer = versions[0]!;

  return (
    <AppLayout
      title="Compare"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Compare" }]}
    >
      <PageHeader
        title="Version comparison"
        subtitle="See how prompt and tool changes shifted reliability between versions."
        actions={
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
            aria-label="Select agent"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="rounded-xl border border-border bg-card">
        <VersionComparisonTable
          rows={buildRows(older, newer)}
          versionA={older.version}
          versionB={newer.version}
        />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium">Reliability over time</h2>
        <TrendChart data={reliabilityTrend} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[older, newer].map((v) => (
          <div key={v.version} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium">{v.version}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{v.createdAt}</p>
            <p className="mt-3 text-sm text-muted-foreground">{v.notes}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
