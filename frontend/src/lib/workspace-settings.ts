/**
 * Workspace settings.
 *
 * The backend has no settings endpoint, so these live in the browser. They are
 * not decoration: `scenariosPerRun` and `adversarial` are read by every evaluation
 * the console starts and shape the suite that gets generated.
 *
 * Only settings that something actually reads live here. Alert email, regression
 * alerts and auto-re-run were removed rather than kept as controls that toggle
 * nothing: this deployment has no mailer, no notification channel and no post-run
 * hook, so each one promised behaviour that never happened.
 */
import { useCallback, useEffect, useState } from 'react';

export interface WorkspaceSettings {
  /** Suite size for every run started from the console. */
  scenariosPerRun: number;
  /** Gates adversarial scenario generation — prompt injection, jailbreaks. */
  adversarial: boolean;
  /**
   * Which agent actually answers the scenarios. `behavioral` is the deterministic
   * stand-in that makes the demo reproducible; `llm` puts a real model under test.
   */
  adapter: 'behavioral' | 'llm';
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  scenariosPerRun: 12,
  adversarial: true,
  // A real model by default. The behavioural stand-in ignores the system prompt
  // entirely, so someone who writes their own agent and runs it would get a score
  // that does not move when they change the prompt — which reads as broken, and is
  // the opposite of what this product is demonstrating.
  adapter: 'llm',
};

const KEY = 'aegis.settings.v2';

export function loadSettings(): WorkspaceSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
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
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

/** The suite generates one scenario per category per `perCategory`, over four categories. */
export function perCategoryFor(scenariosPerRun: number): number {
  return Math.max(1, Math.min(10, Math.round(scenariosPerRun / 4)));
}

/** The options every "run evaluation" button sends, from one place. */
export function runOptionsFor(versionLabel: string) {
  const settings = loadSettings();
  return {
    versionLabel,
    perCategory: perCategoryFor(settings.scenariosPerRun),
    // The toggle gates scenario *generation*. Wiring it to the agent under test
    // instead made switching it off raise the score, which is backwards.
    adversarial: settings.adversarial,
    adapter: settings.adapter,
  };
}

export function useWorkspaceSettings() {
  // Read after mount so the first paint matches whatever the markup shipped with.
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  useEffect(() => setSettings(loadSettings()), []);

  const update = useCallback((patch: Partial<WorkspaceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      // Saved on change rather than behind a Save button: a settings screen whose
      // values silently do not apply is worse than no settings screen.
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}
