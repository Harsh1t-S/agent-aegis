import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { ProgressPipeline } from "@/components/aegis/ProgressPipeline";
import { LiveActivityFeed, type ActivityEvent } from "@/components/aegis/LiveActivityFeed";
import { Button } from "@/components/ui/button";
import { useEvaluationProgress } from "@/lib/live-data";

export const Route = createFileRoute("/evaluations/$evaluationId/running")({
  head: () => ({
    meta: [
      { title: "Evaluation in progress · Aegis" },
      {
        name: "description",
        content:
          "Watch a sandboxed AI agent evaluation execute in real time: scenario generation, execution, analysis and scoring.",
      },
      { property: "og:title", content: "Evaluation in progress · Aegis" },
      {
        property: "og:description",
        content: "Live progress pipeline and activity feed for a running agent evaluation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RunningPage,
});

const steps = [
  { label: "Provisioning sandbox", detail: "Isolated runtime with mocked tools" },
  { label: "Generating scenarios", detail: "Adversarial and edge-case prompts" },
  { label: "Executing agent", detail: "Running scenarios with full tracing" },
  { label: "Analyzing behavior", detail: "Grounding, safety and tool-use checks" },
  { label: "Scoring reliability", detail: "Aggregating metrics into a report" },
];


function RunningPage() {
  const { evaluationId } = useParams({ from: "/evaluations/$evaluationId/running" });
  // Real progress from the backend, polled until the run reports completion.
  const { progress, done } = useEvaluationProgress(evaluationId);

  const total = progress?.total ?? 0;
  const completedScenarios = progress?.completed ?? 0;
  const tick = total ? Math.round((completedScenarios / total) * 100) : 0;
  const agentName = progress?.agentName ?? "Agent";
  const versionLabel = progress?.version ?? "";

  // Newest first, and toned by what the run actually reported rather than a cycle.
  const events: ActivityEvent[] = (progress?.events ?? [])
    .map((message, index) => ({
      id: index,
      message,
      time: "",
      tone: /FAILED|detected/i.test(message)
        ? ("danger" as ActivityEvent["tone"])
        : /warning/i.test(message)
          ? ("warning" as ActivityEvent["tone"])
          : ("success" as ActivityEvent["tone"]),
    }))
    .reverse();

  const currentIndex = done ? steps.length : Math.min(steps.length - 1, Math.floor(tick / 20));

  return (
    <AppLayout
      title="Evaluation running"
      crumbs={[
        { label: "Aegis", to: "/dashboard" },
        { label: "Evaluations", to: "/evaluations" },
        { label: "Running" },
      ]}
    >
      <PageHeader
        title={`${agentName} · ${versionLabel}`}
        subtitle={`Run ${evaluationId} · ${completedScenarios} of ${total} scenarios executed`}
        actions={
          done ? (
            <Button variant="hero" asChild>
              <Link to="/evaluations/$evaluationId" params={{ evaluationId }}>
                View report <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">{done ? "Completed" : "In progress"}</span>
          <span className="font-mono text-muted-foreground">{tick}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${tick}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium">Pipeline</h2>
          <ProgressPipeline steps={steps} currentIndex={currentIndex} />
        </div>
        <div className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Live activity</h2>
          <LiveActivityFeed events={events} />
        </div>
      </div>
    </AppLayout>
  );
}
