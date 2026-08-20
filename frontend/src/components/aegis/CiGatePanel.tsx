import { CheckCircle2, Copy, ShieldX, Terminal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Evaluation } from "@/lib/types";
import { useWorkspaceSettings } from "@/lib/workspace-settings";

/**
 * The CI gate, shown where the result is.
 *
 * `python -m app.ci` is the real gate — it runs a suite and exits non-zero to
 * stop a merge. That lives in a terminal, so nothing in the product ever showed
 * that Aegis can block a bad version from shipping. This renders the same
 * verdict against the same thresholds, and hands over the command that enforces
 * it in a pipeline.
 */
export function CiGatePanel({ evaluation, agentId }: { evaluation: Evaluation; agentId: string }) {
  const { settings } = useWorkspaceSettings();
  const minScore = settings.criticalThreshold;
  const criticals = (evaluation.failureBreakdown ?? [])
    .filter((row) => row.severity === "critical")
    .reduce((sum, row) => sum + row.count, 0);

  const gates = [
    {
      label: `Reliability ≥ ${minScore}`,
      ok: evaluation.score >= minScore,
      detail: `scored ${evaluation.score}`,
    },
    { label: "No critical failures", ok: criticals === 0, detail: `${criticals} critical` },
    {
      label: "No failing scenarios",
      ok: evaluation.failed === 0,
      detail: `${evaluation.failed} failed`,
    },
  ];
  const passed = gates.every((g) => g.ok);

  const command =
    `python -m app.ci --base https://aegis-api-harsh1t.vercel.app \\\n` +
    `    --agent ${agentId || "<agent-id>"} \\\n` +
    `    --min-score ${minScore} --max-critical 0`;

  return (
    <section
      className={`rounded-xl border p-5 ${
        passed ? "border-success/30 bg-success/6" : "border-destructive/30 bg-destructive/6"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {passed ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : (
            <ShieldX className="size-5 text-destructive" />
          )}
          <div>
            <h3 className="text-sm font-semibold">
              {passed ? "Build would pass" : "Build would fail"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Aegis exits non-zero on these gates, so a pipeline stops the merge.
            </p>
          </div>
        </div>
        <span
          className={`rounded-md px-2 py-1 font-mono text-xs ${
            passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
          }`}
        >
          exit {passed ? 0 : 1}
        </span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {gates.map((gate) => (
          <li key={gate.label} className="flex items-center gap-2 text-xs">
            <span className={gate.ok ? "text-success" : "text-destructive"}>
              {gate.ok ? "PASS" : "FAIL"}
            </span>
            <span>{gate.label}</span>
            <span className="text-muted-foreground">· {gate.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-border bg-surface/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
            <Terminal className="size-3.5" /> Run this in CI
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const write = navigator.clipboard?.writeText(command);
              if (!write) return;
              void write.then(
                () => toast.success("Command copied"),
                () => toast.error("Could not copy — clipboard permission denied."),
              );
            }}
          >
            <Copy className="size-3.5" /> Copy
          </Button>
        </div>
        <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
          {command}
        </pre>
      </div>
    </section>
  );
}
