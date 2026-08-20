import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";

/**
 * Editing the agent under test.
 *
 * The prompt was fixed at creation, so every version ran against the same
 * instructions and "v2 hardened the rules" could not be done in the product at
 * all — which is the one change version comparison exists to measure. Existing
 * versions keep the prompt they were judged against; only the next run uses this.
 */
export function EditAgentDialog({ agent, onSaved }: { agent: Agent; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [saving, setSaving] = useState(false);

  // The agent arrives empty on the first render and fills in when the fetch lands.
  useEffect(() => {
    if (open) return;
    setName(agent.name);
    setDescription(agent.description);
    setPrompt(agent.systemPrompt);
  }, [agent.name, agent.description, agent.systemPrompt, open]);

  const save = async () => {
    if (!prompt.trim() || !name.trim()) {
      toast.error("Name and system prompt are required.");
      return;
    }
    setSaving(true);
    try {
      await api.updateAgent(agent.id, {
        name: name.trim(),
        description: description.trim(),
        systemPrompt: prompt.trim(),
      });
      toast.success("Agent updated — the next run uses these instructions");
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the agent.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="surface" size="sm">
          <Pencil className="size-3.5" /> Edit agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit agent</DialogTitle>
          <DialogDescription>
            Runs already recorded keep the prompt they were judged against. Evaluate again after
            saving to compare the two versions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Agent name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-prompt">System prompt</Label>
            <Textarea
              id="edit-prompt"
              rows={14}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length} characters · scenarios are regenerated from this on the next run.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="hero" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
