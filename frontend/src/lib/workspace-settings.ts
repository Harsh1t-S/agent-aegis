/**
 * Workspace settings.
 *
 * The backend has no settings endpoint, so these live in the browser. They are
 * not decoration: `scenariosPerRun` and `adversarial` are read by
 * `useRunEvaluation` and shape every run launched from the UI.
 */
import { useCallback, useEffect, useState } from "react";

/**
 * Only settings that something actually reads live here. Alert email, regression
 * alerts and auto-re-run were removed rather than kept as controls that toggle
 * nothing: this deployment has no mailer, no notification channel and no
 * post-run hook, so each one promised behaviour that never happened.
 */
export interface WorkspaceSettings {
  /** Shown in the sidebar. */
  workspaceName: string;
  /** Suite size for every run started from the UI. */
  scenariosPerRun: number;
  /** Drives every reliability tone and label in the app. */
  criticalThreshold: number;
  /** Gates adversarial scenario generation. */
  adversarial: boolean;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  workspaceName: "Local workspace",
  scenariosPerRun: 12,
  criticalThreshold: 65,
  adversarial: true,
};

const KEY = "aegis.settings.v1";

export function loadSettings(): WorkspaceSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<WorkspaceSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: WorkspaceSettings) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

/** The suite generates one scenario per category per `perCategory`, over four categories. */
export function perCategoryFor(scenariosPerRun: number): number {
  return Math.max(1, Math.min(10, Math.round(scenariosPerRun / 4)));
}

export function useWorkspaceSettings() {
  // Read after mount so server-rendered markup matches the client's first paint.
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  useEffect(() => setSettings(loadSettings()), []);
  const update = useCallback(
    (patch: Partial<WorkspaceSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [],
  );
  const persist = useCallback((next: WorkspaceSettings) => {
    saveSettings(next);
    setSettings(next);
  }, []);
  return { settings, update, persist };
}
