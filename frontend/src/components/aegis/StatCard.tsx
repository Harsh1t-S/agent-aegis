import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: string;
  deltaDirection?: "up" | "down";
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  hint?: string;
  className?: string;
}

const iconTone: Record<string, string> = {
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaDirection = "up",
  tone = "primary",
  hint,
  className,
}: StatCardProps) {
  const Trend = deltaDirection === "up" ? TrendingUp : TrendingDown;
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong",
        className,
      )}
      title={hint}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-lg", iconTone[tone])}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs",
            deltaDirection === "up" ? "text-success" : "text-destructive",
          )}
        >
          <Trend className="size-3.5" />
          {delta}
        </p>
      )}
      {hint && !delta && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
