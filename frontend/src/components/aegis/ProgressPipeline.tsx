import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineStep {
  label: string;
  detail: string;
}

export function ProgressPipeline({
  steps,
  currentIndex,
}: {
  steps: PipelineStep[];
  currentIndex: number;
}) {
  return (
    <ol className="relative space-y-1">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3.5 pb-4">
            {!isLast && (
              <span
                className={cn(
                  "absolute top-8 bottom-0 left-[15px] w-px",
                  done ? "bg-success/40" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "z-10 grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
                done && "border-success/40 bg-success/15 text-success",
                active && "pulse-ring border-primary/40 bg-primary/15 text-primary",
                !done && !active && "border-border bg-surface text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="size-3.5" />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Circle className="size-2.5" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  !done && !active && "text-muted-foreground",
                  active && "text-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
