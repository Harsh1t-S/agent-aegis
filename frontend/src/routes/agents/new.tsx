import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RiskLevel } from "@/lib/types";
import { api } from "@/lib/api";
import { loadSettings, perCategoryFor } from "@/lib/workspace-settings";

export const Route = createFileRoute("/agents/new")({
  head: () => ({
    meta: [
      { title: "New Agent · Aegis" },
      {
        name: "description",
        content:
          "Describe your agent's prompt, domain and tools so Aegis can generate realistic and adversarial test scenarios.",
      },
      { property: "og:title", content: "New Agent · Aegis" },
      {
        property: "og:description",
        content: "Configure an AI agent for automated reliability evaluation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewAgentPage,
});

interface DraftTool {
  key: string;
  name: string;
  description: string;
  risk: RiskLevel;
}

const domains = [
  "Customer Service",
  "Finance Operations",
  "Knowledge & Research",
  "Developer Experience",
  "SRE & Observability",
  "Healthcare",
  "Legal",
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

const DRAFT_KEY = "aegis.agent-draft.v1";

interface Draft {
  name: string;
  description: string;
  domain: string;
  prompt: string;
  tools: DraftTool[];
}

function NewAgentPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tools, setTools] = useState<DraftTool[]>([
    { key: "tool-1", name: "", description: "", risk: "low" },
  ]);
  const [saving, setSaving] = useState(false);

  // Restore a draft saved on this device, so "Save as Draft" survives a reload.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Draft;
      setName(draft.name ?? "");
      setDescription(draft.description ?? "");
      setDomain(draft.domain ?? "");
      setPrompt(draft.prompt ?? "");
      if (draft.tools?.length) setTools(draft.tools);
      toast("Draft restored", { description: "Picked up where you left off." });
    } catch {
      /* a corrupt draft should never block the form */
    }
  }, []);

  const saveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ name, description, domain, prompt, tools } satisfies Draft),
      );
      toast.success("Draft saved on this device");
    } catch {
      toast.error("Could not save the draft.");
    }
  };

  const updateTool = (key: string, patch: Partial<DraftTool>) =>
    setTools((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const submit = async () => {
    if (!name.trim() || !domain || !prompt.trim()) {
      toast.error("Agent name, domain and system prompt are required.");
      return;
    }
    const named = tools.filter((t) => t.name.trim());
    if (named.length === 0) {
      toast.error("Add at least one tool — scenarios are generated from the tool schema.");
      return;
    }
    setSaving(true);
    try {
      // Register, profile, generate a suite and queue the whole run in two calls.
      const created = await api.createAgent({
        name: name.trim(),
        description: description.trim() || domain,
        systemPrompt: prompt.trim(),
        tools: named.map((t) => ({
          name: t.name.trim(),
          description: t.description.trim(),
          risk: t.risk,
        })),
      });
      toast.success(`Agent created — ${created.tools.length} tools profiled`);
      localStorage.removeItem(DRAFT_KEY);

      const settings = loadSettings();
      const started = await api.evaluate(created.id, {
        versionLabel: "v1",
        traits: settings.adversarial ? ["complies_with_destructive", "claims_success"] : [],
        perCategory: perCategoryFor(settings.scenariosPerRun),
      });
      toast.success(`Generated ${started.total} scenarios — evaluation running`);
      void navigate({
        to: "/evaluations/$evaluationId/running",
        params: { evaluationId: started.evaluationId },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the agent.");
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="New Agent"
      crumbs={[
        { label: "Aegis", to: "/dashboard" },
        { label: "Agents", to: "/agents" },
        { label: "New agent" },
      ]}
    >
      <PageHeader
        title="Create agent"
        subtitle="Aegis uses this configuration to synthesize its evaluation suite."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Section title="Basic information" description="How this agent appears across Aegis.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Agent name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer Support Agent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger id="domain">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handles refunds, order lookups and escalation for an e-commerce brand."
                rows={3}
              />
            </div>
          </Section>

          <Section
            title="Agent instructions"
            description="The exact system prompt your agent runs with in production."
          >
            <div className="space-y-2">
              <Label htmlFor="prompt">System prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={12}
                className="font-mono text-xs leading-relaxed"
                placeholder={
                  "You are a customer support agent for…\n\nAlways verify order eligibility before discussing refunds.\nNever promise a policy exception that is not supported by tool output."
                }
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length} characters · adversarial coverage improves with explicit
                constraints.
              </p>
            </div>
          </Section>

          <Section
            title="Available tools"
            description="Tools are mocked in the sandbox; risk level drives adversarial pressure."
          >
            <div className="space-y-3">
              {tools.map((tool, i) => (
                <div key={tool.key} className="rounded-lg border border-border bg-surface/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-muted-foreground">tool_{i + 1}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove tool"
                      disabled={tools.length === 1}
                      onClick={() => setTools((prev) => prev.filter((t) => t.key !== tool.key))}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_150px]">
                    <Input
                      value={tool.name}
                      onChange={(e) => updateTool(tool.key, { name: e.target.value })}
                      placeholder="check_order"
                      className="font-mono text-xs"
                    />
                    <Input
                      value={tool.description}
                      onChange={(e) => updateTool(tool.key, { description: e.target.value })}
                      placeholder="Look up an order and return eligibility"
                    />
                    <Select
                      value={tool.risk}
                      onValueChange={(v) => updateTool(tool.key, { risk: v as RiskLevel })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low risk</SelectItem>
                        <SelectItem value="medium">Medium risk</SelectItem>
                        <SelectItem value="high">High risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="surface"
              size="sm"
              onClick={() =>
                setTools((prev) => [
                  ...prev,
                  { key: `tool-${Date.now()}`, name: "", description: "", risk: "low" },
                ])
              }
            >
              <Plus className="size-3.5" /> Add tool
            </Button>
          </Section>

          <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
            <Button variant="ghost" onClick={() => void navigate({ to: "/agents" })}>
              Cancel
            </Button>
            <Button variant="surface" onClick={saveDraft}>
              Save as Draft
            </Button>
            <Button variant="hero" onClick={() => void submit()} disabled={saving}>
              {saving ? "Creating…" : "Create Agent"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-primary/25 bg-primary/6 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">How Aegis uses this</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Aegis analyses your system prompt, domain and tool schema to generate realistic user
              scenarios plus adversarial variants — prompt injection, contradictory instructions,
              out-of-policy requests and tool-failure chains. High-risk tools receive additional
              safety probes.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-info" />
              <h3 className="text-sm font-semibold">Tips</h3>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>· State hard constraints explicitly ("never promise a refund without…").</li>
              <li>· Mark any tool that mutates state as high risk.</li>
              <li>· Include escalation rules so safety scenarios have a correct answer.</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
