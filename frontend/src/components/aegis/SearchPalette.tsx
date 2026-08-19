import { useNavigate } from "@tanstack/react-router";
import { Bot, FlaskConical, LayoutDashboard } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAgents, useEvaluations } from "@/lib/live-data";

const pages = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Agents", to: "/agents" },
  { label: "Evaluations", to: "/evaluations" },
  { label: "Reports", to: "/reports" },
  { label: "Version Comparison", to: "/compare" },
  { label: "Settings", to: "/settings" },
  { label: "New Agent", to: "/agents/new" },
] as const;

/** Header search: jumps to any agent, run or page. Also bound to ⌘K / Ctrl-K. */
export function SearchPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data: agents } = useAgents();
  const { data: evaluations } = useEvaluations();

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search agents, runs and pages…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem
              key={p.to}
              value={`page ${p.label}`}
              onSelect={() => go(() => void navigate({ to: p.to }))}
            >
              <LayoutDashboard className="size-4 text-muted-foreground" /> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {agents.length > 0 && (
          <CommandGroup heading="Agents">
            {agents.map((a) => (
              <CommandItem
                key={a.id}
                value={`agent ${a.name} ${a.domain}`}
                onSelect={() =>
                  go(() => void navigate({ to: "/agents/$agentId", params: { agentId: a.id } }))
                }
              >
                <Bot className="size-4 text-muted-foreground" /> {a.name}
                <span className="ml-auto text-xs text-muted-foreground">{a.domain}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {evaluations.length > 0 && (
          <CommandGroup heading="Evaluations">
            {evaluations.slice(0, 12).map((e) => (
              <CommandItem
                key={e.id}
                value={`run ${e.agentName} ${e.version} ${e.id}`}
                onSelect={() =>
                  go(
                    () =>
                      void navigate({
                        to: "/evaluations/$evaluationId",
                        params: { evaluationId: e.id },
                      }),
                  )
                }
              >
                <FlaskConical className="size-4 text-muted-foreground" /> {e.agentName} ·{" "}
                {e.version}
                <span className="ml-auto font-mono text-xs text-muted-foreground">{e.score}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
