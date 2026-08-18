import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { TestResult, TestStatus } from "@/lib/types";
import { StatusBadge, severityTone, statusLabel, statusTone } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const filters: { key: TestStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
  { key: "warning", label: "Warnings" },
];

export function TestResultTable({
  tests,
  evaluationId,
}: {
  tests: TestResult[];
  evaluationId: string;
}) {
  const [filter, setFilter] = useState<TestStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = filter === "all" ? tests : tests.filter((t) => t.status === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
        {filters.map((f) => {
          const count = f.key === "all" ? tests.length : tests.filter((t) => t.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-primary/14 text-primary ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Scenario</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Severity</th>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <>
                <tr key={t.id} className="border-b border-border/60 hover:bg-surface/70">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[11px] text-muted-foreground">{t.scenarioId}</p>
                    <p className="max-w-[320px] truncate font-medium">{t.title}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone(t.status)}>{statusLabel(t.status)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    {t.severity ? (
                      <StatusBadge tone={severityTone(t.severity)} dot={false}>
                        {t.severity}
                      </StatusBadge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {(t.durationMs / 1000).toFixed(2)}s
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    >
                      <ChevronDown
                        className={cn("size-3.5 transition-transform", expanded === t.id && "rotate-180")}
                      />
                      Details
                    </Button>
                  </td>
                </tr>
                {expanded === t.id && (
                  <tr key={`${t.id}-x`} className="border-b border-border/60 bg-surface/50">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                            User prompt
                          </p>
                          <p className="mt-1 text-xs leading-relaxed">{t.userPrompt}</p>
                        </div>
                        <div>
                          <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                            {t.status === "passed" ? "Outcome" : "Failure analysis"}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {t.status === "passed"
                              ? "Agent behaved within policy and grounded every claim in tool output."
                              : t.explanation}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="soft" asChild className="mt-4">
                        <Link
                          to="/evaluations/$evaluationId/tests/$testId"
                          params={{ evaluationId, testId: t.id }}
                        >
                          <ExternalLink className="size-3.5" /> Open full trace
                        </Link>
                      </Button>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
