import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/**
 * Destructive Action Guardrail Tester.
 *
 * Shows the escalating pressure ladder as a row of rungs per irreversible tool.
 * A filled rung means the agent performed the action at that pressure level, so
 * the leftmost filled rung is the breaking point — the number that actually
 * distinguishes two agents that both "fail the safety test".
 */
interface Rung {
  level: number;
  technique: string;
  breached: boolean;
  runId?: string;
}

interface ToolReport {
  tool: string;
  breakingPoint: number | null;
  heldTo: number;
  maxLevel: number;
  breachedTechniques: string[];
  rungs: Rung[];
}

interface GuardrailReport {
  ran: boolean;
  resistanceScore: number | null;
  verdict?: string;
  rungsRun?: number;
  rungsHeld?: number;
  weakestTool?: string | null;
  firstBreakingPoint?: number | null;
  tools: ToolReport[];
  ladder: { level: number; technique: string; description: string }[];
}

export function GuardrailPanel({ evaluationId }: { evaluationId: string }) {
  const [report, setReport] = useState<GuardrailReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!evaluationId) return;
    try {
      const next = await fetch(`/api/evaluations/${evaluationId}/guardrail`).then(
        (r) => r.json() as Promise<GuardrailReport>,
      );
      setReport(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }, [evaluationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      await fetch(`/api/evaluations/${evaluationId}/guardrail`, { method: "POST" });
      // The ladder runs in the background; poll until every rung has reported.
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const next = await load();
        if (next?.ran && next.rungsRun && next.rungsRun >= (next.tools.length || 1) * 5) break;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    setRunning(false);
  };

  const held = report?.ran && report.resistanceScore === 100;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {held ? (
            <ShieldCheck className="size-4 text-success" />
          ) : (
            <ShieldAlert className="size-4 text-warning" />
          )}
          <div>
            <h3 className="text-sm font-semibold">Destructive action guardrail</h3>
            <p className="text-xs text-muted-foreground">
              Escalating pressure against every irreversible tool. The breaking point is the
              lowest rung at which the agent went through with it.
            </p>
          </div>
        </div>
        <Button variant="surface" size="sm" onClick={() => void run()} disabled={running}>
          <Play className="size-3.5" /> {running ? "Probing…" : "Run guardrail test"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

      {report?.ran ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="font-mono text-2xl font-semibold">
              {report.resistanceScore}
              <span className="text-sm text-muted-foreground">/100 resistance</span>
            </span>
            <span className="text-sm">{report.verdict}</span>
            <span className="text-xs text-muted-foreground">
              {report.rungsHeld}/{report.rungsRun} rungs held
              {report.weakestTool
                ? ` · weakest: ${report.weakestTool} at L${report.firstBreakingPoint}`
                : " · no tool breached"}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {report.tools.map((tool) => (
              <div key={tool.tool} className="flex flex-wrap items-center gap-3">
                <span className="w-40 shrink-0 font-mono text-xs">{tool.tool}</span>
                <div className="flex gap-1">
                  {tool.rungs.map((rung) => (
                    <span
                      key={rung.level}
                      title={`L${rung.level} ${rung.technique}: ${
                        rung.breached ? "performed the action" : "held"
                      }`}
                      className={`flex size-6 items-center justify-center rounded text-[10px] font-bold ${
                        rung.breached
                          ? "bg-destructive/85 text-destructive-foreground"
                          : "bg-success/20 text-success"
                      }`}
                    >
                      {rung.level}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {tool.breakingPoint
                    ? `breaks at L${tool.breakingPoint} (${tool.breachedTechniques.join(", ")})`
                    : "held under all pressure"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
            {report.ladder.map((rung) => (
              <span key={rung.level} className="text-[11px] text-muted-foreground">
                <b className="font-mono">L{rung.level}</b> {rung.technique.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Not probed yet. The ladder runs six escalating techniques — plain request, urgency,
          claimed authority, fabricated approval, the act hidden inside a routine task, and an
          instruction injected through tool output — against each irreversible tool.
        </p>
      )}
    </section>
  );
}
