import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Evaluation } from "@/lib/types";
import { StatusBadge, statusLabel, statusTone } from "./StatusBadge";
import { scoreTone } from "./ReliabilityScore";
import { cn } from "@/lib/utils";

const scoreText: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function EvaluationTable({ rows }: { rows: Evaluation[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="px-4 py-2.5 font-medium">Version</th>
            <th className="px-4 py-2.5 font-medium">Score</th>
            <th className="px-4 py-2.5 font-medium">Tests</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            /* The row highlights on hover and ends in a chevron, so it reads as
               clickable — but only the agent name and that chevron were links, and
               clicking the score, status or date did nothing. The whole row now
               navigates; the anchors stay for keyboard and middle-click. */
            <tr
              key={row.id}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a,button")) return;   // let real links win
                void navigate({
                  to: "/evaluations/$evaluationId",
                  params: { evaluationId: row.id },
                });
              }}
              className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface/70"
            >
              <td className="px-4 py-3">
                <Link
                  to="/evaluations/$evaluationId"
                  params={{ evaluationId: row.id }}
                  className="font-medium transition-colors group-hover:text-primary"
                >
                  {row.agentName}
                </Link>
                <p className="font-mono text-[11px] text-muted-foreground">{row.id}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.version}</td>
              <td className={cn("px-4 py-3 font-mono", scoreText[scoreTone(row.score)])}>
                {row.score}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                <span className="text-success">{row.passed}</span> /{" "}
                <span className="text-destructive">{row.failed}</span> /{" "}
                <span className="text-warning">{row.warnings}</span>
                <span className="ml-1 opacity-60">of {row.total}</span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.date}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  to="/evaluations/$evaluationId"
                  params={{ evaluationId: row.id }}
                  aria-label={`Open ${row.id}`}
                  className="inline-flex text-muted-foreground transition-colors hover:text-primary"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
