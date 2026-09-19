import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { setActiveWorkspace } from '@/lib/session';
import { setWorkspaceSettings } from '@/lib/workspace-settings';
import { useAuth } from '@/contexts/AuthContext';
import type { Bootstrap, Workspace } from '@/types';

interface WorkspaceState {
  workspaces: Workspace[];
  current: Workspace | null;
  bootstrap: Bootstrap | null;
  loading: boolean;
  error: string | null;
  select(id: string): void;
  refresh(): Promise<void>;
  create(name: string): Promise<Workspace>;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);
const STORAGE_KEY = 'aegis.workspace.v1';

function savedWorkspace() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setBootstrap(null);
      setSelected(null);
      setActiveWorkspace(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.bootstrap();
      const preferred = savedWorkspace();
      const id = data.workspaces.some((workspace) => workspace.id === preferred)
        ? preferred!
        : data.currentWorkspaceId;
      setBootstrap(data);
      setSelected(id);
      setActiveWorkspace(id);
      const workspace = data.workspaces.find((item) => item.id === id);
      if (workspace) setWorkspaceSettings(workspace.settings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open your workspace.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const select = useCallback((id: string) => {
    const workspace = bootstrap?.workspaces.find((item) => item.id === id);
    if (!workspace) return;
    setSelected(id);
    setActiveWorkspace(id);
    setWorkspaceSettings(workspace.settings);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // The selection still works for this tab.
    }
  }, [bootstrap]);

  const create = useCallback(async (name: string) => {
    const workspace = await api.createWorkspace(name);
    setBootstrap((current) => current
      ? { ...current, workspaces: [...current.workspaces, workspace] }
      : current);
    setSelected(workspace.id);
    setActiveWorkspace(workspace.id);
    setWorkspaceSettings(workspace.settings);
    try {
      localStorage.setItem(STORAGE_KEY, workspace.id);
    } catch {
      // The new workspace is still active for this tab.
    }
    return workspace;
  }, []);

  const current = bootstrap?.workspaces.find((workspace) => workspace.id === selected) ?? null;
  const value = useMemo<WorkspaceState>(() => ({
    workspaces: bootstrap?.workspaces ?? [],
    current,
    bootstrap,
    loading,
    error,
    select,
    refresh: load,
    create,
  }), [bootstrap, create, current, error, load, loading, select]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
