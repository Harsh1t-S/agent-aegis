import type { ToolDraft } from './api';

export interface AgentForm {
  name: string;
  description: string;
  domain: string;
  systemPrompt: string;
  tools: ToolDraft[];
}

export const EMPTY_AGENT_FORM: AgentForm = {
  name: '', description: '', domain: '', systemPrompt: '',
  tools: [{ name: '', description: '', risk: 'low' }],
};
const DRAFT_KEY = 'aegis.agent-draft.v2';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function clearAgentDraft(): boolean {
  try {
    localStorage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadAgentDraft(): AgentForm | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object' ||
        typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt) ||
        draft.savedAt > Date.now() || Date.now() - draft.savedAt > DRAFT_TTL_MS ||
        !['name', 'description', 'domain', 'systemPrompt'].every(
          (key) => typeof draft[key] === 'string') ||
        !Array.isArray(draft.tools) || !draft.tools.every((tool: unknown) => {
          if (!tool || typeof tool !== 'object') return false;
          const row = tool as Record<string, unknown>;
          return typeof row.name === 'string' && typeof row.description === 'string' &&
            ['low', 'medium', 'high'].includes(String(row.risk)) &&
            (row.parameters === undefined || (row.parameters !== null &&
              typeof row.parameters === 'object' && !Array.isArray(row.parameters)));
        })) {
      clearAgentDraft();
      return;
    }
    return { name: draft.name, description: draft.description, domain: draft.domain,
      systemPrompt: draft.systemPrompt, tools: draft.tools };
  } catch {
    return;
  }
}

export function saveAgentDraft(form: AgentForm): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, savedAt: Date.now() }));
}

/** Manual rows need the same duplicate protection as imported schemas. */
export function toolNamesError(tools: ToolDraft[]): string | undefined {
  const names = new Set<string>();
  for (const tool of tools) {
    const name = tool.name.trim();
    if (!name) continue;
    if (names.has(name)) return `Duplicate tool name "${name}". Give each tool a unique name.`;
    names.add(name);
  }
  if (!names.size) return 'Add at least one named tool.';
}
