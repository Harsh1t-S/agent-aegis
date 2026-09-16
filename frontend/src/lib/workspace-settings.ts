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
import { useCallback, useEffect, useRef, useState } from 'react';

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
let memorySettings: WorkspaceSettings | undefined;

function normalizeSettings(value: unknown): WorkspaceSettings {
  const input = value && typeof value === 'object' ? value as Partial<WorkspaceSettings> : {};
  return {
    scenariosPerRun: typeof input.scenariosPerRun === 'number' && Number.isFinite(input.scenariosPerRun)
      ? Math.max(4, Math.min(40, Math.round(input.scenariosPerRun))) : DEFAULT_SETTINGS.scenariosPerRun,
    adversarial: typeof input.adversarial === 'boolean' ? input.adversarial : DEFAULT_SETTINGS.adversarial,
    adapter: input.adapter === 'behavioral' || input.adapter === 'llm' ? input.adapter : DEFAULT_SETTINGS.adapter,
  };
}

export function loadSettings(): WorkspaceSettings {
  if (memorySettings) return memorySettings;
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : undefined);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: WorkspaceSettings): boolean {
  const normalized = normalizeSettings(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
    memorySettings = undefined;
    return true;
  } catch {
    // Every run button reads loadSettings(), so changes still apply in this tab
    // when storage is blocked or full. The settings screen reports persistence.
    memorySettings = normalized;
    return false;
  }
}

/** The suite generates one scenario per category per `perCategory`, over four categories. */
export function perCategoryFor(scenariosPerRun: number): number {
  const count = Number.isFinite(scenariosPerRun) ? scenariosPerRun : DEFAULT_SETTINGS.scenariosPerRun;
  return Math.max(1, Math.min(10, Math.round(count / 4)));
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
  const current = useRef(settings);
  const [storageAvailable, setStorageAvailable] = useState(!memorySettings);
  useEffect(() => {
    const refresh = () => {
      current.current = loadSettings();
      setSettings(current.current);
    };
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) {
        memorySettings = undefined;
        refresh();
        setStorageAvailable(true);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const apply = useCallback((next: WorkspaceSettings) => {
    current.current = normalizeSettings(next);
    const persisted = saveSettings(current.current);
    setStorageAvailable(persisted);
    setSettings(current.current);
    return persisted;
  }, []);

  const update = useCallback((patch: Partial<WorkspaceSettings>) =>
    apply({ ...current.current, ...patch }), [apply]);
  const reset = useCallback(() => apply(DEFAULT_SETTINGS), [apply]);

  return { settings, update, reset, storageAvailable };
}
