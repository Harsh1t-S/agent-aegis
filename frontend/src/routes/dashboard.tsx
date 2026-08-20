import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Bot, FlaskConical, Gauge, Plus, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { LoadingState } from "@/components/aegis/EmptyState";
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
        content:
          "Reliability scores, failure distribution and evaluation history for your AI agents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

/** "+2.4" / "-3.1" / "0" — never the "+-3.1" the old template produced. */
function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function Dashboard() {
  const { data: dashboardStats, loading: statsLoading } = useDashboard();
  const { data: evaluations } = useEvaluations();
  const reliabilityTrend = dashboardStats.trend;
  const evaluation = evaluations[0] ?? EMPTY_EVALUATION;
  const score = dashboardStats.averageReliability;
  // A dashboard of confident zeroes is a wrong answer, not a slow one.
  const pending = statsLoading && dashboardStats.testsExecuted === 0;

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

      {pending ? (
        <div className="mt-6">
          <LoadingState rows={4} title="Loading workspace metrics…" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Average Reliability"
            value={`${score}/100`}
            icon={Gauge}
            // Prepending "+" unconditionally rendered a regression as "+-30.9%",
            // and the default direction painted it as an improvement.
            delta={`${signed(dashboardStats.reliabilityDelta)}% from previous evaluations`}
            deltaDirection={dashboardStats.reliabilityDelta < 0 ? "down" : "up"}
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
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-1">
          <p className="text-sm font-medium">Overall Reliability Score</p>
          <p className="text-xs text-muted-foreground">Weighted across all evaluated agents</p>
          <div className="mt-5 flex flex-col items-center">
            <ReliabilityScore score={score} size={190} />
            {/* Was the literal string "Good — Needs Attention" regardless of the
                score, which contradicted the label directly beneath it. */}
            <p className="mt-3 text-sm font-medium">{scoreLabel(score)}</p>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            {/* These are the newest run's metrics, not workspace averages like the
                score above them. Unlabelled, they read as its components. */}
            <p className="mb-3 text-xs text-muted-foreground">
              Latest run{evaluation.agentName ? ` · ${evaluation.agentName}` : ""}
              {evaluation.version ? ` · ${evaluation.version}` : ""}
            </p>
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
              {/* Was always text-success, so a regression was painted as a gain. */}
              <span
                className={
                  dashboardStats.reliabilityDelta < 0
                    ? "font-mono text-xs text-destructive"
                    : "font-mono text-xs text-success"
                }
              >
                {signed(dashboardStats.reliabilityDelta)} vs previous version
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
            <p className="text-xs text-muted-foreground">
              Click a row to open the reliability report
            </p>
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
