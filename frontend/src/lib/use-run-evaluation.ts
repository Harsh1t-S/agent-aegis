/**
 * Launches a real evaluation and follows it to the running page.
 *
 * Every "Run / Re-run / Evaluate" control in the app goes through here, so the
 * suite size and adversarial toggle from workspace settings apply everywhere.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { api } from "./api";
import { loadSettings, perCategoryFor } from "./workspace-settings";

/**
 * Next label in the vN series. The API defaults every run to "v1", which stacks
 * indistinguishable versions on an agent and leaves /compare with nothing to diff.
 */
export function nextVersionLabel(existing: string[]): string {
  const highest = existing.reduce((max, label) => {
    const match = /^v(\d+)/.exec(label.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `v${highest + 1}`;
}

export function useRunEvaluation() {
  const navigate = useNavigate();
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  const run = async (agentId: string, versionLabel?: string) => {
    if (!agentId || runningAgentId) return;
    setRunningAgentId(agentId);
    try {
      const settings = loadSettings();
      const started = await api.evaluate(agentId, {
        ...(versionLabel ? { versionLabel } : {}),
        // The toggle gates scenario generation. It must not change the agent
        // under test — doing that made switching it off improve the score.
        adversarial: settings.adversarial,
        perCategory: perCategoryFor(settings.scenariosPerRun),
      });
      toast.success(`Generated ${started.total} scenarios — evaluation running`);
      void navigate({
        to: "/evaluations/$evaluationId/running",
        params: { evaluationId: started.evaluationId },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the evaluation.");
      setRunningAgentId(null);
    }
  };

  return { run, runningAgentId };
}
