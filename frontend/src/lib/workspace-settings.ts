/**
 * Workspace settings.
 *
 * The backend has no settings endpoint, so these live in the browser. They are
 * not decoration: `scenariosPerRun` and `adversarial` are read by
 * `useRunEvaluation` and shape every run launched from the UI.
 */
import { useCallback, useEffect, useState } from "react";

export interface WorkspaceSettings {
  workspaceName: string;
  alertEmail: string;
  scenariosPerRun: number;
  criticalThreshold: number;
  adversarial: boolean;
  regressionAlerts: boolean;
  autoRerun: boolean;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  workspaceName: "Aegis Labs",
  alertEmail: "reliability@aegis.dev",
  scenariosPerRun: 12,
  criticalThreshold: 65,
  adversarial: true,
  regressionAlerts: true,
  autoRerun: false,
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
