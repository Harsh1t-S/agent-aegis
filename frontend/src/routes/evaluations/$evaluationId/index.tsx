import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GitCompare, History, Repeat } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { StatCard } from "@/components/aegis/StatCard";
import { ReliabilityScore, scoreLabel } from "@/components/aegis/ReliabilityScore";
import { FailureChart, MetricBars } from "@/components/aegis/Charts";
import { TestResultTable } from "@/components/aegis/TestResultTable";
import { GuardrailPanel } from "@/components/aegis/GuardrailPanel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { EMPTY_EVALUATION, useAgent, useEvaluation } from "@/lib/live-data";
import { nextVersionLabel, useRunEvaluation } from "@/lib/use-run-evaluation";

export const Route = createFileRoute("/evaluations/$evaluationId/")({
  head: () => ({
    meta: [
      { title: "Reliability report · Aegis" },
      {
        name: "description",
        content:
          "Full reliability report for an evaluation run: score, metric breakdown, failure distribution and every test scenario.",
      },
      { property: "og:title", content: "Reliability report · Aegis" },
      {
        property: "og:description",
        content: "Score, metrics, failures and scenario-level results for one evaluation run.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { evaluationId } = useParams({ from: "/evaluations/$evaluationId/" });
  const [replaying, setReplaying] = useState(false);
  const { data: loaded } = useEvaluation(evaluationId);
  const evaluation = loaded ?? EMPTY_EVALUATION;
  const { data: agent } = useAgent(evaluation.agentId || undefined);
  const { run, runningAgentId } = useRunEvaluation();
  const delta = evaluation.score - evaluation.previousScore;

  return (
    <AppLayout
      title="Reliability report"
      crumbs={[
        { label: "Aegis", to: "/dashboard" },
        { label: "Evaluations", to: "/evaluations" },
        { label: evaluation.id },
      ]}
      actions={
        <Button variant="surface" size="sm" asChild>
          <Link to="/compare">
            <GitCompare className="size-4" /> Compare
          </Link>
        </Button>
      }
    >
      <PageHeader
        title={`${evaluation.agentName} · ${evaluation.version}`}
        subtitle={`Run ${evaluation.id} · ${evaluation.total} scenarios executed on ${evaluation.date}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="hero"
            onClick={() =>
              void run(
                evaluation.agentId,
                nextVersionLabel((agent?.versions ?? []).map((v) => v.version)),
              )
            }
            disabled={!!runningAgentId || !evaluation.agentId}
          >
            <Repeat className="size-4" /> {runningAgentId ? "Starting…" : "Re-run evaluation"}
          </Button>
          <Button
            variant="surface"
            size="sm"
            disabled={replaying}
            onClick={() => {
              setReplaying(true);
              api
                .reanalyze(evaluation.id)
                .then((r) =>
                  toast.success(
                    `Replayed ${r.replayed} traces with ${r.detectorVersion} — ` +
                      `${r.changed} verdict${r.changed === 1 ? "" : "s"} changed`,
                  ),
                )
                .catch((e: unknown) =>
                  toast.error(e instanceof Error ? e.message : "Replay failed"),
                )
                .finally(() => setReplaying(false));
            }}
          >
            <History className="size-4" /> {replaying ? "Replaying…" : "Replay traces"}
          </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6">
          <ReliabilityScore score={evaluation.score} label={scoreLabel(evaluation.score)} />
          <p className="mt-4 text-sm text-muted-foreground">
            {delta >= 0 ? "+" : ""}
            {delta} pts vs previous run
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Passed" value={String(evaluation.passed)} icon={Repeat} />
          <StatCard label="Failed" value={String(evaluation.failed)} icon={Repeat} />
          <StatCard label="Warnings" value={String(evaluation.warnings)} icon={Repeat} />
          <div className="rounded-xl border border-border bg-card p-5 sm:col-span-3">
            <h2 className="mb-4 text-sm font-medium">Metric breakdown</h2>
            <MetricBars metrics={evaluation.metrics} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium">Failure distribution</h2>
        <FailureChart data={evaluation.failureBreakdown} />

        <GuardrailPanel evaluationId={evaluation.id} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card">
        <TestResultTable tests={evaluation.tests} evaluationId={evaluation.id} />
      </div>
    </AppLayout>
  );
}
