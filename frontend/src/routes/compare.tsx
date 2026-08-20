import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { EmptyState } from "@/components/aegis/EmptyState";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/aegis/PageHeader";
import {
  VersionComparisonTable,
  type ComparisonRow,
} from "@/components/aegis/VersionComparisonTable";
import { TrendChart } from "@/components/aegis/Charts";
import { EMPTY_AGENT, useAgents } from "@/lib/live-data";
import { api, type ComparisonEntry, type VersionComparison } from "@/lib/api";
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

/** "+2.4" / "-3.1" / "0" — never "+-3.1". */
function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function ScenarioList({
  title,
  tone,
  entries,
  empty,
}: {
  title: string;
  tone: string;
  entries: ComparisonEntry[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 p-4">
      <p className={`text-xs font-semibold ${tone}`}>
        {title} · {entries.length}
      </p>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.slice(0, 8).map((entry) => (
            <li key={entry.scenario_id} className="text-xs">
              <p className="font-medium">{entry.scenario}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {entry.from} → {entry.to}
                {entry.failure_types.length ? ` · ${entry.failure_types.join(", ")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComparePage() {
  const { data: agents } = useAgents();
  // Empty until the first response lands, so the selection defaults lazily.
  const [agentId, setAgentId] = useState<string>("");
  const agent = agents.find((a) => a.id === agentId) ?? agents[0] ?? EMPTY_AGENT;
  const versions = agent.versions;
  // Empty on the first render and single-entry for an agent evaluated only once,
  // so a diff needs two versions before it means anything.
  const comparable = versions.length >= 2;

  // Both ends are chosen. Pinning them to oldest and newest meant an agent on v4
  // had no way to look at v2 -> v3 at all.
  const [olderId, setOlderId] = useState<string>("");
  const [newerId, setNewerId] = useState<string>("");
  const older = versions.find((v) => v.id === olderId) ?? versions[versions.length - 1];
  const newer = versions.find((v) => v.id === newerId) ?? versions[0];
  const shown = comparable ? [older!, newer!] : versions;

  // Scenario-level regressions only exist server-side; diffing the two version
  // rows locally can compare metrics but never tell you which scenario broke.
  const [diff, setDiff] = useState<VersionComparison | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  useEffect(() => {
    if (!older?.id || !newer?.id || older.id === newer.id) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setDiffError(null);
    api
      .compareVersions(older.id, newer.id)
      .then((next) => !cancelled && setDiff(next))
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDiff(null);
        setDiffError(cause instanceof Error ? cause.message : "Comparison unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [older?.id, newer?.id]);

  // This agent's own versions, oldest first — the workspace-wide dashboard trend
  // does not move when you change the agent, so it described someone else's data.
  const reliabilityTrend = useMemo(
    () => [...versions].reverse().map((v) => ({ date: v.version, score: v.reliability })),
    [versions],
  );

  return (
    <AppLayout
      title="Compare"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Compare" }]}
    >
      <PageHeader
        title="Version comparison"
        subtitle="See how prompt and tool changes shifted reliability between versions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                setOlderId("");
                setNewerId("");
              }}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
              aria-label="Select agent"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {comparable ? (
              <>
                <select
                  value={older?.id ?? ""}
                  onChange={(e) => setOlderId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
                  aria-label="Baseline version"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">vs</span>
                <select
                  value={newer?.id ?? ""}
                  onChange={(e) => setNewerId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
                  aria-label="Comparison version"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
        }
      />

      {comparable ? (
        <div className="rounded-xl border border-border bg-card">
          <VersionComparisonTable
            rows={buildRows(older!, newer!)}
            versionA={older!.version}
            versionB={newer!.version}
          />
        </div>
      ) : (
        <EmptyState
          icon={GitCompare}
          title="Nothing to compare yet"
          description="A diff needs two evaluated versions. Run this agent again after a prompt or tool change and both show up here side by side."
          action={
            <Button variant="hero" asChild>
              <Link to="/agents">Go to agents</Link>
            </Button>
          }
        />
      )}

      {comparable ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Scenario changes</h2>
            {diff ? (
              <p className="text-xs text-muted-foreground">
                {diff.shared_scenarios} scenario{diff.shared_scenarios === 1 ? "" : "s"} run in both
                versions · score {signed(diff.score_delta)}
              </p>
            ) : null}
          </div>
          {diffError ? (
            <p className="mt-3 text-xs text-destructive">{diffError}</p>
          ) : !diff ? (
            <p className="mt-3 text-xs text-muted-foreground">Loading comparison…</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <ScenarioList
                title="Regressions"
                tone="text-destructive"
                entries={diff.regressions}
                empty="Nothing that passed before is failing now."
              />
              <ScenarioList
                title="Softened"
                tone="text-warning"
                entries={diff.softened}
                empty="No scenario picked up new findings."
              />
              <ScenarioList
                title="Improvements"
                tone="text-success"
                entries={diff.improvements}
                empty="No scenario improved."
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Reliability over time</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
          {agent.name} — one point per evaluated version.
        </p>
        <TrendChart data={reliabilityTrend} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Keyed by position: both pickers can name the same version, and keying
            on the label duplicated the React key when they do. */}
        {shown.map((v, index) => (
          <div
            key={`${index}-${v.id || v.version}`}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h3 className="text-sm font-medium">
              {v.version}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {index === 0 ? "baseline" : "comparison"}
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{v.createdAt}</p>
            <p className="mt-3 text-sm text-muted-foreground">{v.notes}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
