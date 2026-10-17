import { useEffect, useRef, useState } from 'react';
import { buttonPrimary, buttonSecondary, fieldInput } from '@/lib/ui';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SystemLabel } from '@/components/SystemLabel';
import { AsyncBoundary } from '@/components/AsyncState';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError, type ToolDraft } from '@/lib/api';
import { parseToolSchema, toolsToJson } from '@/lib/tool-schema';
import { toolNamesError } from '@/lib/agent-draft';
import { ClipboardPaste, Loader2, Plus, Trash2, Upload } from 'lucide-react';

/**
 * Editing the agent is what makes the regression story real.
 *
 * "v1 scored 30, we hardened the prompt, v2 scored 96, v3 regressed" is the whole
 * demo — and without an edit screen the only way to produce v2 was to POST to the
 * API by hand. An agent you cannot change has no versions worth comparing.
 */
export default function EditAgent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const agent = useResource(() => api.agent(id as string), [id], { enabled: Boolean(id) });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [tools, setTools] = useState<ToolDraft[]>([]);
  const [connectionMode, setConnectionMode] = useState<'simulation' | 'connected'>('simulation');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [runnerToken, setRunnerToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [showSchema, setShowSchema] = useState(false);
  const [schemaText, setSchemaText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Seed the form once the agent arrives. Keyed on id so navigating between two
  // agents does not leave the previous one's prompt in the box.
  useEffect(() => {
    if (!agent.data) return;
    setName(agent.data.name);
    setDescription(agent.data.description);
    setSystemPrompt(agent.data.systemPrompt);
    setConnectionMode(agent.data.connection?.mode ?? 'simulation');
    setEndpointUrl(agent.data.connection?.url ?? '');
    setTools(
      agent.data.tools.map((t) => ({
        name: t.name,
        description: t.description,
        risk: t.risk,
        ...(t.parameters ? { parameters: t.parameters } : {}),
      })),
    );
  }, [agent.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTool = (i: number, key: keyof ToolDraft, value: string) =>
    setTools((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  const importSchema = (text: string) => {
    const { tools: parsed, errors } = parseToolSchema(text);
    if (!parsed.length) {
      toast.error('Nothing imported', errors[0] ?? 'No tools found in that schema.');
      return;
    }
    setTools(
      parsed.map((tool) => ({
        name: tool.name,
        description: tool.description,
        ...(tool.risk ? { risk: tool.risk } : {}),
        ...(tool.parameters ? { parameters: tool.parameters } : {}),
      })),
    );
    setShowSchema(false);
    toast.success(`Replaced the tool list with ${parsed.length} imported tool${parsed.length === 1 ? '' : 's'}`);
  };

  const save = async () => {
    if (!id || saving) return;
    const named = tools.filter((t) => t.name.trim());
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error('Name and system prompt are both required.');
      return;
    }
    if (connectionMode === 'connected' && !/^https?:\/\//i.test(endpointUrl.trim())) {
      toast.error('Enter the full HTTP(S) URL for the connected runner.');
      return;
    }
    const toolsError = toolNamesError(named);
    if (toolsError) {
      toast.error(toolsError);
      return;
    }
    setSaving(true);
    setSaveError(undefined);
    try {
      await api.updateAgent(id, {
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        tools: named.map((t) => ({
          name: t.name.trim(),
          description: t.description.trim(),
          ...(t.risk ? { risk: t.risk } : {}),
          ...(t.parameters ? { parameters: t.parameters } : {}),
        })),
        connection: {
          mode: connectionMode,
          ...(connectionMode === 'connected' ? { url: endpointUrl.trim() } : {}),
          ...(connectionMode === 'connected' && runnerToken ? { bearerToken: runnerToken } : {}),
        },
      });
      toast.success(
        'Agent updated',
        'Existing evaluations are untouched — run a new one to compare the change against them.',
      );
      navigate(`/app/agents/${id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save the agent.';
      setSaveError(message);
      toast.error('Not saved', message);
      setSaving(false);
    }
  };

  const inputClass = `${fieldInput} py-3`;

  const cancelLink = <Link to={`/app/agents/${id}`} className={buttonSecondary}>Cancel</Link>;
  const saveButton = (
    <button type="button" onClick={save} disabled={saving} className={buttonPrimary}>
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
        </>
      ) : (
        'Save changes'
      )}
    </button>
  );

  return (
    <>
        <PageHeader
          crumbs={[
            { label: 'Agents', to: '/app/agents' },
            { label: agent.data?.name || 'Agent', to: `/app/agents/${id}` },
            { label: 'Edit' },
          ]}
          title="Edit agent"
          actions={<>{cancelLink}{saveButton}</>}
          description="Changing the prompt or the tools does not rewrite any evaluation that already ran. Save, then run a new evaluation; the comparison between the two is the regression report."
        />

        <div className="mt-8 max-w-2xl">
          <AsyncBoundary
            loading={agent.loading}
            error={agent.error}
            onRetry={agent.reload}
            label="Loading agent"
          >
            <div className="space-y-6">
              <div>
                <label htmlFor="edit-name" className="text-sm font-medium text-bone-100 mb-2 block">Agent name
                </label>
                <input
                  id="edit-name"
                  maxLength={200}
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="edit-desc" className="text-sm font-medium text-bone-100 mb-2 block">Description
                </label>
                <textarea
                  id="edit-desc"
                  className={`${inputClass} h-20 resize-none`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <SystemLabel className="!text-bone-300">Test path</SystemLabel>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['simulation', 'connected'] as const).map((mode) => (
                    <button key={mode} type="button" aria-pressed={connectionMode === mode}
                      onClick={() => setConnectionMode(mode)}
                      className={`min-h-11 border px-3 font-mono text-xs tracking-wider ${connectionMode === mode ? 'border-signal-500/50 bg-signal-500/10 text-signal-300' : 'border-bone-600/30 text-bone-400'}`}>
                      {mode === 'simulation' ? 'Prompt simulation' : 'Connected agent'}
                    </button>
                  ))}
                </div>
                {connectionMode === 'connected' && (
                  <div className="mt-3 space-y-3">
                    <input type="url" required className={inputClass}
                      placeholder="https://agent.example.com/aegis/action"
                      value={endpointUrl} onChange={(event) => setEndpointUrl(event.target.value)} />
                    <input type="password" autoComplete="new-password" className={inputClass}
                      placeholder={agent.data?.connection.authenticated ? 'Leave blank to keep the encrypted token' : 'Optional bearer token'}
                      value={runnerToken} onChange={(event) => setRunnerToken(event.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="edit-prompt" className="text-sm font-medium text-bone-100 mb-2 block">System prompt
                </label>
                <textarea
                  id="edit-prompt"
                  className={`${inputClass} h-64 resize-y`}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
                <p className="mt-2 font-mono text-sm text-bone-300">
                  {systemPrompt.length} characters. Aegis re-profiles the prompt on save, so a
                  new constraint becomes a new executable policy predicate.
                </p>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SystemLabel className="!text-bone-300">Tools</SystemLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInput}
                      aria-label="Upload a tool schema JSON file"
                      type="file"
                      accept="application/json,.json,.txt"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.size > 512_000) {
                          toast.error('That file is larger than 500 KB.');
                          event.target.value = '';
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => importSchema(String(reader.result ?? ''));
                        reader.onerror = () => toast.error('Could not read that file.');
                        reader.readAsText(file);
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className={buttonSecondary}
                    >
                      <Upload className="h-3.5 w-3.5" />Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSchemaText(toolsToJson(tools.filter((t) => t.name.trim())));
                        setShowSchema((v) => !v);
                      }}
                      className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-3 font-mono text-xs tracking-wider text-bone-300 transition-colors hover:border-signal-400/50 hover:text-signal-300"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      {showSchema ? 'HIDE' : 'Edit as JSON'}
                    </button>
                  </div>
                </div>

                {showSchema && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      aria-label="Tool schema JSON"
                      rows={10}
                      value={schemaText}
                      onChange={(e) => setSchemaText(e.target.value)}
                      className={`${inputClass} resize-y text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => importSchema(schemaText)}
                      className={buttonPrimary}
                    >Apply JSON
                    </button>
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  {tools.map((tool, i) => (
                    <div key={i} className="border border-bone-300/25 bg-ink-900 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-bone-300">
                          TOOL {String(i + 1).padStart(2, '0')}
                          {tool.parameters && (
                            <span className="ml-2 text-flux-400">· schema</span>
                          )}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove tool ${i + 1}`}
                          onClick={() => setTools((prev) => prev.filter((_, x) => x !== i))}
                          className="-m-2 flex h-11 w-11 items-center justify-center text-bone-300 transition-colors hover:text-fault-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        aria-label={`Tool ${i + 1} name`}
                        className={`${inputClass} mt-3`}
                        value={tool.name}
                        onChange={(e) => updateTool(i, 'name', e.target.value)}
                      />
                      <input
                        aria-label={`Tool ${i + 1} description`}
                        className={`${inputClass} mt-2`}
                        value={tool.description}
                        onChange={(e) => updateTool(i, 'description', e.target.value)}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <SystemLabel className="!text-bone-300">Risk</SystemLabel>
                        {(['low', 'medium', 'high'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={tool.risk === r}
                            onClick={() => updateTool(i, 'risk', r)}
                            className={`flex min-h-9 items-center border px-3 font-mono text-xs tracking-wider transition-colors ${
                              tool.risk === r
                                ? r === 'high'
                                  ? 'border-fault-500/50 text-fault-400'
                                  : r === 'medium'
                                    ? 'border-warn-500/50 text-warn-400'
                                    : 'border-flux-500/50 text-flux-400'
                                : 'border-bone-300/35 text-bone-300'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setTools((prev) => [...prev, { name: '', description: '' }])
                    }
                    className="flex w-full items-center justify-center gap-2 border border-dashed border-bone-600/30 py-3 font-mono text-xs tracking-wider text-bone-300 transition-colors hover:border-signal-400/50 hover:text-signal-300"
                  >
                    <Plus className="h-4 w-4" />Add tool
                  </button>
                </div>
              </div>

              {saveError && (
                <p className="border border-fault-500/40 bg-fault-500/5 px-4 py-3 font-mono text-sm text-fault-300">
                  {saveError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-bone-600/20 pt-6 sm:flex-row sm:justify-end">
                {cancelLink}
                {saveButton}
              </div>
            </div>
          </AsyncBoundary>
        </div>
    </>
  );
}
