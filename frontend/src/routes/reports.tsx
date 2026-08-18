import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileBarChart } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { StatusBadge } from "@/components/aegis/StatusBadge";
import { TrendChart, FailureChart } from "@/components/aegis/Charts";
import { Button } from "@/components/ui/button";
import { EMPTY_EVALUATION, useDashboard, useEvaluations } from "@/lib/live-data";
import { scoreTone } from "@/components/aegis/ReliabilityScore";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Aegis" },
      {
        name: "description",
        content:
          "Aggregate reliability reporting across agents: score trends, failure distribution and downloadable run summaries.",
      },
      { property: "og:title", content: "Reports · Aegis" },
      {
        property: "og:description",
        content: "Workspace-wide reliability trends and evaluation report summaries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: evaluations } = useEvaluations();
  const { data: dashboard } = useDashboard();
  const reliabilityTrend = dashboard.trend;
  const aggregated = (evaluations[0] ?? EMPTY_EVALUATION).failureBreakdown;

  return (
    <AppLayout title="Reports" crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Reports" }]}>
      <PageHeader
        title="Reports"
        subtitle="Workspace-wide reliability trends and per-run summaries."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium">Reliability trend</h2>
          <TrendChart data={reliabilityTrend} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium">Failure distribution</h2>
          <FailureChart data={aggregated} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {evaluations.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                <FileBarChart className="size-4" />
              </span>
              <StatusBadge tone={scoreTone(e.score)}>{e.score}</StatusBadge>
            </div>
            <h3 className="mt-3 text-sm font-medium">{e.agentName}</h3>
            <p className="text-xs text-muted-foreground">
              {e.version} · {e.date} · {e.total} scenarios
            </p>
            <Button variant="soft" size="sm" className="mt-4 w-full" asChild>
              <Link to="/evaluations/$evaluationId" params={{ evaluationId: e.id }}>
                View report <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
