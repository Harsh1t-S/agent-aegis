import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComparisonRow {
  metric: string;
  a: string;
  b: string;
  change: string;
  direction: "improved" | "regressed" | "unchanged";
}

const tone = {
  improved: "text-success",
  regressed: "text-destructive",
  unchanged: "text-muted-foreground",
} as const;

const icon = {
  improved: ArrowUpRight,
  regressed: ArrowDownRight,
  unchanged: Minus,
} as const;

export function VersionComparisonTable({
  rows,
  versionA,
  versionB,
}: {
  rows: ComparisonRow[];
  versionA: string;
  versionB: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Metric</th>
            <th className="px-4 py-2.5 font-medium">{versionA}</th>
            <th className="px-4 py-2.5 font-medium">{versionB}</th>
            <th className="px-4 py-2.5 font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const Icon = icon[r.direction];
            return (
              <tr key={r.metric} className="border-b border-border/60 last:border-0 hover:bg-surface/70">
                <td className="px-4 py-3 font-medium">{r.metric}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{r.a}</td>
                <td className="px-4 py-3 font-mono">{r.b}</td>
                <td className={cn("px-4 py-3 font-mono", tone[r.direction])}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {r.change}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
