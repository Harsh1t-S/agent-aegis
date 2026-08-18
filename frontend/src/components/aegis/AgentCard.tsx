import { Link } from "@tanstack/react-router";
import { Bot, MoreHorizontal, Play, FileBarChart } from "lucide-react";
import type { Agent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel, statusTone } from "./StatusBadge";
import { scoreTone } from "./ReliabilityScore";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const scoreText: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function AgentCard({ agent, onDelete }: { agent: Agent; onDelete?: (id: string) => void }) {
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:border-border-strong hover:shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to="/agents/$agentId"
            params={{ agentId: agent.id }}
            className="block truncate text-sm font-semibold transition-colors hover:text-primary"
          >
            {agent.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{agent.domain}</p>
        </div>
        <StatusBadge tone={statusTone(agent.status)}>{statusLabel(agent.status)}</StatusBadge>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {agent.description}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border bg-surface/60 p-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Version</p>
          <p className="font-mono text-sm">{agent.latestVersion}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Reliability</p>
          <p className={cn("font-mono text-sm", scoreText[scoreTone(agent.reliability)])}>
            {agent.reliability}/100
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Last run</p>
          <p className="font-mono text-sm">{agent.lastEvaluated.slice(5)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="soft" asChild className="flex-1">
          <Link to="/evaluations/$evaluationId/running" params={{ evaluationId: "eval_1043" }}>
            <Play className="size-3.5" /> Evaluate
          </Link>
        </Button>
        <Button size="sm" variant="surface" asChild className="flex-1">
          <Link to="/evaluations/$evaluationId" params={{ evaluationId: "eval_1042" }}>
            <FileBarChart className="size-3.5" /> Report
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/agents/$agentId" params={{ agentId: agent.id }}>
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Duplicate agent</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete?.(agent.id)}
            >
              Delete agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
