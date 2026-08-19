import { createFileRoute, Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { EvaluationTable } from "@/components/aegis/EvaluationTable";
import { Button } from "@/components/ui/button";
import { useEvaluations } from "@/lib/live-data";

export const Route = createFileRoute("/evaluations/")({
  head: () => ({
    meta: [
      { title: "Evaluations · Aegis" },
      {
        name: "description",
        content:
          "Browse every sandboxed evaluation run, with reliability scores, pass rates and failure counts per agent version.",
      },
      { property: "og:title", content: "Evaluations · Aegis" },
      {
        property: "og:description",
        content: "Every sandboxed AI agent evaluation run in one searchable history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { data: evaluations } = useEvaluations();
  return (
    <AppLayout
      title="Evaluations"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Evaluations" }]}
      actions={
        <Button variant="hero" size="sm" asChild>
          <Link to="/agents">
            <Play className="size-4" /> Run Evaluation
          </Link>
        </Button>
      }
    >
      <PageHeader
        title="Evaluations"
        subtitle="All sandboxed runs across your agents, newest first."
      />
      <div className="rounded-xl border border-border bg-card">
        <EvaluationTable rows={evaluations} />
      </div>
    </AppLayout>
  );
}
