import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Bot, FlaskConical, Gauge, Plus, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { StatCard } from "@/components/aegis/StatCard";
import { ReliabilityScore, scoreLabel } from "@/components/aegis/ReliabilityScore";
import { FailureChart, MetricBars, TrendChart } from "@/components/aegis/Charts";
import { EvaluationTable } from "@/components/aegis/EvaluationTable";
import { Button } from "@/components/ui/button";
import { EMPTY_EVALUATION, useDashboard, useEvaluations } from "@/lib/live-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview · Aegis Reliability Dashboard" },
      {
        name: "description",
        content:
          "Monitor AI agent reliability scores, failure distribution and recent evaluation runs across your workspace.",
      },
      { property: "og:title", content: "Overview · Aegis Reliability Dashboard" },
      {
        property: "og:description",
        content: "Reliability scores, failure distribution and evaluation history for your AI agents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: dashboardStats } = useDashboard();
  const { data: evaluations } = useEvaluations();
  const reliabilityTrend = dashboardStats.trend;
  const evaluation = evaluations[0] ?? EMPTY_EVALUATION;
  const score = dashboardStats.averageReliability;

  return (
    <AppLayout
      title="Overview"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Overview" }]}
      actions={
        <Button variant="hero" size="sm" asChild>
          <Link to="/agents/new">
            <Plus className="size-4" /> New Agent
          </Link>
        </Button>
      }
    >
      <PageHeader
        title="Overview"
        subtitle="Monitor your AI agents' reliability and evaluation performance."
        actions={
          <Button variant="hero" asChild>
            <Link to="/agents/new">
              <Plus className="size-4" /> New Agent
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average Reliability"
          value={`${score}/100`}
          icon={Gauge}
          delta={`+${dashboardStats.reliabilityDelta}% from previous evaluations`}
          tone="primary"
        />
        <StatCard
          label="Agents Tested"
          value={String(dashboardStats.agentsTested)}
          icon={Bot}
          hint={`Across ${new Set(evaluations.map((e) => e.agentName)).size} agents`}
          tone="info"
        />
        <StatCard
          label="Tests Executed"
          value={dashboardStats.testsExecuted.toLocaleString("en-US")}
          icon={FlaskConical}
          hint="All completed scenario runs"
          tone="success"
        />
        <StatCard
          label="Critical Failures"
          value={String(dashboardStats.criticalFailures)}
          icon={AlertTriangle}
          delta="Requires triage"
          deltaDirection="down"
          tone="danger"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-1">
          <p className="text-sm font-medium">Overall Reliability Score</p>
          <p className="text-xs text-muted-foreground">Weighted across all evaluated agents</p>
          <div className="mt-5 flex flex-col items-center">
            <ReliabilityScore score={score} size={190} />
            <p className="mt-3 rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              Good — Needs Attention
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{scoreLabel(score)}</p>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <MetricBars metrics={evaluation.metrics} />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reliability trend</p>
                <p className="text-xs text-muted-foreground">Score across recent evaluation runs</p>
              </div>
              <span className="font-mono text-xs text-success">
                {dashboardStats.reliabilityDelta >= 0 ? "+" : ""}
                {dashboardStats.reliabilityDelta} vs previous version
              </span>
            </div>
            <div className="mt-4">
              <TrendChart data={reliabilityTrend} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Failure distribution</p>
                <p className="text-xs text-muted-foreground">Classified across the latest run</p>
              </div>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/reports">
                  All reports <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            <div className="mt-2">
              <FailureChart data={evaluation.failureBreakdown} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <p className="text-sm font-medium">Recent evaluations</p>
            <p className="text-xs text-muted-foreground">Click a row to open the reliability report</p>
          </div>
          <Button size="sm" variant="surface" asChild>
            <Link to="/evaluations">View all</Link>
          </Button>
        </div>
        <EvaluationTable rows={evaluations} />
      </div>
    </AppLayout>
  );
}
