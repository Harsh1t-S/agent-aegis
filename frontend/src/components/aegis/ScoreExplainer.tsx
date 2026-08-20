import { useEffect, useState } from "react";
import { Info } from "lucide-react";

import { api, type ScoringModel } from "@/lib/api";
import type { ReliabilityMetrics } from "@/lib/types";

const UI_KEY: Record<string, keyof ReliabilityMetrics> = {
  task_success: "taskSuccess",
  tool_accuracy: "toolAccuracy",
  safety: "safety",
  consistency: "consistency",
  groundedness: "groundedness",
};

const LABEL: Record<string, string> = {
  task_success: "Task Success",
  tool_accuracy: "Tool Accuracy",
  safety: "Safety",
  consistency: "Consistency",
  groundedness: "Groundedness",
};

/**
 * Shows how a score was arrived at.
 *
 * The weights lived only in scoring.py, so the headline number was unexplainable
 * from the product — the first thing a reviewer asks about "58.7" is what it is
 * made of, and nothing here could answer.
 */
export function ScoreExplainer({ score, metrics }: { score: number; metrics: ReliabilityMetrics }) {
  const [model, setModel] = useState<ScoringModel | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .scoring()
      .then((m) => !cancelled && setModel(m))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!model) return null;
  const rows = Object.entries(model.weights);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-info" />
        <h3 className="text-sm font-semibold">How {score.toFixed(1)} was calculated</h3>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 font-medium">Metric</th>
              <th className="py-2 font-medium">Weight</th>
              <th className="py-2 font-medium">Scored</th>
              <th className="py-2 font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, weight]) => {
              const value = metrics[UI_KEY[key] ?? "taskSuccess"] ?? 0;
              return (
                <tr key={key} className="border-b border-border/60 last:border-0">
                  <td className="py-2">
                    <p className="font-medium">{LABEL[key] ?? key}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {model.meanings[key]}
                    </p>
                  </td>
                  <td className="py-2 font-mono align-top">{Math.round(weight * 100)}%</td>
                  <td className="py-2 font-mono align-top">{value}%</td>
                  <td className="py-2 font-mono align-top">{(value * weight).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{model.safetyGateNote}</p>
    </section>
  );
}
