import { AlertTriangle, Copy, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge, severityTone } from "./StatusBadge";
import type { Severity } from "@/lib/types";

export function FailureAnalysisCard({
  failureType,
  severity,
  explanation,
  recommendation,
  onRerun,
}: {
  failureType: string;
  severity: Severity | null;
  explanation: string;
  recommendation: string;
  /** Must actually queue the run; the card reports whatever this resolves to. */
  onRerun?: () => Promise<void>;
}) {
  const [rerunning, setRerunning] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-destructive/30 bg-destructive/6 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
            <AlertTriangle className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Failure: {failureType}</h3>
              <StatusBadge tone={severityTone(severity)} dot={false}>
                {severity ?? "unknown"} severity
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/6 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Recommendation</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{recommendation}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              // Reporting success before the write resolves lies whenever the
              // clipboard permission is denied or the API is missing entirely.
              const write = navigator.clipboard?.writeText(recommendation);
              if (!write) {
                toast.error("Clipboard unavailable in this browser.");
                return;
              }
              void write.then(
                () => toast.success("Recommendation copied to clipboard"),
                () => toast.error("Could not copy — clipboard permission denied."),
              );
            }}
          >
            <Copy className="size-3.5" /> Copy recommendation
          </Button>
          <Button
            size="sm"
            variant="surface"
            disabled={!onRerun || rerunning}
            onClick={() => {
              if (!onRerun) return;
              setRerunning(true);
              void onRerun().finally(() => setRerunning(false));
            }}
          >
            <RotateCcw className="size-3.5" /> {rerunning ? "Re-running…" : "Re-run test"}
          </Button>
        </div>
      </div>
    </div>
  );
}
