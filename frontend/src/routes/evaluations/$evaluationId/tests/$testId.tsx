import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { TraceTimeline } from "@/components/aegis/TraceTimeline";
import { FailureAnalysisCard } from "@/components/aegis/FailureAnalysisCard";
import { StatusBadge, statusLabel, statusTone } from "@/components/aegis/StatusBadge";
import { Button } from "@/components/ui/button";
import { EMPTY_EVALUATION, useEvaluation } from "@/lib/live-data";

export const Route = createFileRoute("/evaluations/$evaluationId/tests/$testId")({
  head: () => ({
    meta: [
      { title: "Trace detail · Aegis" },
      {
        name: "description",
        content:
          "Step-by-step execution trace for a single agent test scenario, with failure analysis and remediation guidance.",
      },
      { property: "og:title", content: "Trace detail · Aegis" },
      {
        property: "og:description",
        content: "Reasoning steps, tool calls and failure analysis for one agent test scenario.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TraceDetail,
});

function TraceDetail() {
  const { evaluationId, testId } = useParams({
    from: "/evaluations/$evaluationId/tests/$testId",
  });
  const { data: loaded } = useEvaluation(evaluationId);
  const evaluation = loaded ?? EMPTY_EVALUATION;
  const test = evaluation.tests.find((t) => t.id === testId) ?? evaluation.tests[0]!;

  return (
    <AppLayout
      title="Trace"
      crumbs={[
        { label: "Aegis", to: "/dashboard" },
        { label: "Evaluations", to: "/evaluations" },
        { label: evaluation.id, to: `/evaluations/${evaluation.id}` },
        { label: test.id },
      ]}
      actions={
        <Button variant="surface" size="sm" asChild>
          <Link to="/evaluations/$evaluationId" params={{ evaluationId: evaluation.id }}>
            <ArrowLeft className="size-4" /> Back to report
          </Link>
        </Button>
      }
    >
      <PageHeader
        title={test.title}
        subtitle={`${test.category} · ${test.durationMs} ms · scenario ${test.scenarioId}`}
        actions={<StatusBadge tone={statusTone(test.status)}>{statusLabel(test.status)}</StatusBadge>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium">Execution trace</h2>
          <TraceTimeline steps={test.trace} />
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <Section title="User prompt" body={test.userPrompt} />
            <Section title="Expected behavior" body={test.expectedBehavior} />
            <Section title="Agent response" body={test.agentResponse} />
          </div>

          {test.status !== "passed" && (
            <FailureAnalysisCard
              failureType={test.failureType ?? "Unclassified"}
              severity={test.severity}
              explanation={test.explanation}
              recommendation={test.recommendation}
              onRerun={() => toast.success("Scenario queued for re-run")}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <p className="text-sm leading-relaxed">{body}</p>
    </div>
  );
}
