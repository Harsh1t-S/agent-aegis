import { AlertTriangle, Check, Cpu, MessageSquare, Play, Wrench } from "lucide-react";
import type { TraceStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const icons = {
  start: Play,
  reasoning: Cpu,
  "tool-call": Wrench,
  "tool-response": Check,
  response: MessageSquare,
  failure: AlertTriangle,
} as const;

export function TraceTimeline({ steps }: { steps: TraceStep[] }) {
  return (
    <ol className="relative space-y-1">
      {steps.map((step, i) => {
        const Icon = icons[step.kind];
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3.5 pb-4">
            {!isLast && (
              <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                "z-10 grid size-8 shrink-0 place-items-center rounded-full border",
                step.failed
                  ? "border-destructive/40 bg-destructive/15 text-destructive"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-lg border px-3.5 py-2.5",
                step.failed
                  ? "border-destructive/35 bg-destructive/8"
                  : "border-border bg-card",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={cn("text-sm font-medium", step.failed && "text-destructive")}>
                  {step.label}
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">{step.timestamp}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] break-words text-muted-foreground">
                {step.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
