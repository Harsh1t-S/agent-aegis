import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bot, Plus, Search, SlidersHorizontal } from "lucide-react";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { AgentCard } from "@/components/aegis/AgentCard";
import { EmptyState } from "@/components/aegis/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAgents } from "@/lib/live-data";
import { toast } from "sonner";

export const Route = createFileRoute("/agents/")({
  head: () => ({
    meta: [
      { title: "Agents · Aegis" },
      {
        name: "description",
        content: "Every AI agent in your workspace with domain, latest version and reliability score.",
      },
      { property: "og:title", content: "Agents · Aegis" },
      { property: "og:description", content: "Browse and evaluate the AI agents in your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { data: mockAgents } = useAgents();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);

  const agents = useMemo(
    () =>
      mockAgents
        .filter((a) => !removed.includes(a.id))
        .filter((a) => (status === "all" ? true : a.status === status))
        .filter((a) =>
          `${a.name} ${a.domain}`.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    [query, status, removed],
  );

  const target = mockAgents.find((a) => a.id === pendingDelete);

  return (
    <AppLayout
      title="Agents"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Agents" }]}
      actions={
        <Button variant="hero" size="sm" asChild>
          <Link to="/agents/new">
            <Plus className="size-4" /> New Agent
          </Link>
        </Button>
      }
    >
      <PageHeader
        title="Agents"
        subtitle="Every agent under evaluation, with its latest reliability score."
        actions={
          <Button variant="hero" asChild>
            <Link to="/agents/new">
              <Plus className="size-4" /> New Agent
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents or domains…"
            className="bg-card pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full bg-card sm:w-[200px]">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="reliable">Reliable</SelectItem>
            <SelectItem value="needs-attention">Needs attention</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {agents.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Bot}
            title="No agents match your filters"
            description="Try a different search term, or create a new agent to start generating adversarial scenarios."
            action={
              <Button variant="hero" asChild>
                <Link to="/agents/new">
                  <Plus className="size-4" /> New Agent
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the agent, all of its versions and every stored evaluation
              trace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) setRemoved((r) => [...r, pendingDelete]);
                toast.success("Agent deleted");
                setPendingDelete(null);
              }}
            >
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
