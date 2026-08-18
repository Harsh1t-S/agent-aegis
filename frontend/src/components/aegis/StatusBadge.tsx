import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "primary" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "bg-success/12 text-success border-success/25",
  danger: "bg-destructive/12 text-destructive border-destructive/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  info: "bg-info/12 text-info border-info/25",
  primary: "bg-primary/14 text-primary border-primary/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "passed":
    case "reliable":
    case "completed":
      return "success";
    case "failed":
    case "critical":
      return "danger";
    case "warning":
    case "needs-attention":
      return "warning";
    case "running":
    case "queued":
      return "info";
    default:
      return "neutral";
  }
}

export function severityTone(severity: string | null): BadgeTone {
  switch (severity) {
    case "critical":
      return "danger";
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    passed: "Passed",
    failed: "Failed",
    warning: "Warning",
    reliable: "Reliable",
    "needs-attention": "Needs attention",
    critical: "Critical",
    completed: "Completed",
    running: "Running",
    queued: "Queued",
    "never-run": "Never evaluated",
  };
  return map[status] ?? status;
}
