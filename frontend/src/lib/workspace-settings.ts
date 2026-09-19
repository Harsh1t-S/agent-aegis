/**
 * Workspace settings.
 *
 * The workspace provider hydrates this cache from the server. Synchronous run
 * buttons can then build their request without a second network round-trip.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { WorkspaceSettings } from '@/types';

export type { WorkspaceSettings };

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  scenariosPerRun: 12,
  adversarial: true,
  // Keep a new workspace free until the user deliberately chooses a model run.
  adapter: 'behavioral',
  notifications: { emailEnabled: false, email: '' },
};

const KEY = 'aegis.settings.v2';
let memorySettings: WorkspaceSettings | undefined;

function normalizeSettings(value: unknown): WorkspaceSettings {
  const input = value && typeof value === 'object' ? value as Partial<WorkspaceSettings> : {};
  return {
    scenariosPerRun: typeof input.scenariosPerRun === 'number' && Number.isFinite(input.scenariosPerRun)
      ? Math.max(4, Math.min(40, Math.round(input.scenariosPerRun))) : DEFAULT_SETTINGS.scenariosPerRun,
    adversarial: typeof input.adversarial === 'boolean' ? input.adversarial : DEFAULT_SETTINGS.adversarial,
    adapter: input.adapter === 'behavioral' || input.adapter === 'llm' || input.adapter === 'http'
      ? input.adapter : DEFAULT_SETTINGS.adapter,
    ...(typeof input.monthlySpendCapUsd === 'number' && Number.isFinite(input.monthlySpendCapUsd)
      ? { monthlySpendCapUsd: Math.max(0, input.monthlySpendCapUsd) }
      : {}),
    notifications: {
      emailEnabled: Boolean(input.notifications?.emailEnabled),
      email: typeof input.notifications?.email === 'string' ? input.notifications.email : '',
    },
  };
}

export function setWorkspaceSettings(value: unknown) {
  memorySettings = normalizeSettings(value);
  try {
    localStorage.setItem(KEY, JSON.stringify(memorySettings));
  } catch {
    // The in-memory copy is enough for this tab.
  }
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
  memorySettings = normalized;
  try {
    localStorage.setItem(KEY, JSON.stringify(normalized));
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
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRevision = useRef(0);
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
    const revision = ++saveRevision.current;
    setSaving(true);
    setSaveError(null);
    void api.updateWorkspaceSettings(current.current).then(
      () => {
        if (saveRevision.current === revision) setSaving(false);
      },
      (cause: unknown) => {
        if (saveRevision.current !== revision) return;
        setSaving(false);
        setSaveError(cause instanceof Error ? cause.message : 'Workspace settings could not be saved.');
      },
    );
    return persisted;
  }, []);

  const update = useCallback((patch: Partial<WorkspaceSettings>) =>
    apply({ ...current.current, ...patch }), [apply]);
  const reset = useCallback(() => apply(DEFAULT_SETTINGS), [apply]);

  return { settings, update, reset, storageAvailable, saving, saveError };
}
