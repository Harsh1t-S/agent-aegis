import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buttonPrimary, buttonSecondary, fieldInput } from '@/lib/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/Toaster';
import {
  ArrowRight,
  ArrowLeft,
  ClipboardPaste,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  Cable,
  FlaskConical,
} from 'lucide-react';
import { api, ApiError, type ToolDraft } from '@/lib/api';
import { parseToolSchema, toolsToJson } from '@/lib/tool-schema';
import { clearAgentDraft, EMPTY_AGENT_FORM, loadAgentDraft, saveAgentDraft, toolNamesError, type AgentForm } from '@/lib/agent-draft';

const steps = ['01 Identity', '02 Instructions', '03 Tools', '04 Review'];

const SCHEMA_PLACEHOLDER = [
  '[',
  '  {"type": "function", "function": {',
  '    "name": "get_order",',
  '    "description": "Look up an order by id",',
  '    "parameters": {"type": "object",',
  '      "properties": {"order_id": {"type": "string"}},',
  '      "required": ["order_id"]}}}',
  ']',
].join('\n');

export default function NewAgent() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [form, setForm] = useState<AgentForm>(EMPTY_AGENT_FORM);
  const [runnerToken, setRunnerToken] = useState('');

  const [showSchema, setShowSchema] = useState(false);
  const [schemaText, setSchemaText] = useState('');
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Restore a draft saved on this device, so "Save draft" survives a reload.
  useEffect(() => {
    const draft = loadAgentDraft();
    if (draft) {
      setForm(draft);
      toast.info('Draft restored', 'Picked up where you left off.');
    }
    // Once, on mount. Re-running on every toast identity change would re-restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: keyof AgentForm, value: AgentForm[keyof AgentForm]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setToolRisk = (i: number, risk: ToolDraft['risk']) =>
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.map((t, idx) => (idx === i ? { ...t, risk } : t)),
    }));

  const updateTool = (i: number, key: keyof ToolDraft, value: string) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)),
    }));
  };

  const addTool = () => {
    setForm((prev) => ({
      ...prev,
      tools: [...prev.tools, { name: '', description: '' }],
    }));
  };

  const removeTool = (i: number) => {
    setForm((prev) => ({ ...prev, tools: prev.tools.filter((_, idx) => idx !== i) }));
  };

  /** Replaces the draft rows with whatever the pasted or uploaded schema holds. */
  const importSchema = (text: string) => {
    const { tools: parsed, errors } = parseToolSchema(text);
    setSchemaErrors(errors);
    if (!parsed.length) {
      toast.error('Nothing imported', errors[0] ?? 'No tools found in that schema.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      tools: parsed.map((tool) => ({
        name: tool.name,
        description: tool.description,
        // A declared risk overrides the backend's own classification, so only an
        // explicit one is kept; otherwise Aegis derives it from the tool's verb.
        ...(tool.risk ? { risk: tool.risk } : {}),
        // The JSON-Schema block travels to the API, so generated scenarios get the
        // real argument shape instead of calling issue_refund() with no arguments.
        ...(tool.parameters ? { parameters: tool.parameters } : {}),
      })),
    }));
    setShowSchema(false);
    toast.success(
      `Imported ${parsed.length} tool${parsed.length === 1 ? '' : 's'}`,
      errors.length ? `${errors.length} entry skipped: ${errors[0]}` : undefined,
    );
  };

  const copyToolsOut = () => {
    const named = form.tools.filter((t) => t.name.trim());
    if (!named.length) {
      toast.error('No tools to copy yet.');
      return;
    }
    // Risk and parameters have to travel too, or an export → re-import cycle
    // quietly rewrites the tool definition.
    const json = toolsToJson(named);
    setSchemaText(json);
    setShowSchema(true);
    const write = navigator.clipboard?.writeText(json);
    if (!write) {
      toast.success('Tools written to the box above.');
      return;
    }
    void write.then(
      () => toast.success('Tools copied to clipboard'),
      () => toast.success('Tools written to the box above.'),
    );
  };

  const saveDraft = () => {
    try {
      saveAgentDraft(form);
      toast.success(
        'Draft saved in this browser',
        'Stored unencrypted in local storage, system prompt included. Cleared after 7 days, or when the agent is created.',
      );
    } catch {
      toast.error('Could not save the draft.');
    }
  };

  const toolsError = toolNamesError(form.tools);
  const canProceed = () => {
    if (step === 0) return Boolean(form.name.trim()) && form.name.trim().length <= 200
      && (form.connectionMode === 'simulation' || /^https?:\/\//i.test(form.endpointUrl.trim()));
    if (step === 1) return Boolean(form.systemPrompt.trim());
    if (step === 2) return !toolsError;
    return true;
  };

  const handleSubmit = async () => {
    if (submitting || toolsError || !form.name.trim() || !form.systemPrompt.trim()) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      // The domain is derived server-side from the system prompt, so it is not
      // sent — showing it as an editable field that silently vanished was worse
      // than labelling it as a hint.
      const agent = await api.createAgent({
        name: form.name.trim(),
        description: form.description.trim(),
        systemPrompt: form.systemPrompt.trim(),
        tools: form.tools
          .filter((t) => t.name.trim())
          .map((t) => ({
            name: t.name.trim(),
            description: t.description.trim(),
            ...(t.risk ? { risk: t.risk } : {}),
            ...(t.parameters ? { parameters: t.parameters } : {}),
          })),
        connection: {
          mode: form.connectionMode,
          ...(form.connectionMode === 'connected' ? { url: form.endpointUrl.trim() } : {}),
          ...(form.connectionMode === 'connected' && runnerToken ? { bearerToken: runnerToken } : {}),
        },
      });
      // Local draft cleanup cannot undo a successful server create.
      const cleared = clearAgentDraft();
      toast.success(
        `Agent created — ${agent.tools.length} tool${agent.tools.length === 1 ? '' : 's'} profiled`,
      );
      if (!cleared) toast.info('Agent saved', 'This browser could not clear the saved draft.');
      navigate(`/app/agents/${agent.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not create the agent.';
      setSubmitError(message);
      toast.error('Agent not created', message);
      setSubmitting(false);
    }
  };

  // 16px on phones on purpose: iOS Safari zooms the whole page in when a focused
  // input has a font-size below 16px, and the zoom does not come back out.
  const inputClass = `${fieldInput} py-3`;

  return (
    <div className="new-agent-page">
        <PageHeader
          crumbs={[{ label: 'Agents', to: '/app/agents' }, { label: 'New agent' }]}
          title="New agent"
          description="Describe the agent, how Aegis should reach it, and the tools it can call. Nothing runs until you review the suite."
        />

        <div className="max-w-3xl">
        {/* Progress */}
        <ol className="flex items-center gap-2 sm:gap-3" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s} className="flex min-w-0 items-center gap-2 sm:gap-3">
              {/* Steps already visited are reachable again: a four-step form that
                  only moves forwards makes a typo on step 1 a restart. */}
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${s.replace(/^\d+\s/, '')}`}
                className={`flex min-h-11 min-w-11 items-center justify-center gap-2 disabled:cursor-default ${
                  i === step ? 'text-signal-300' : i < step ? 'text-flux-300' : 'text-bone-300'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${
                    i === step
                      ? 'border-signal-400 bg-signal-500 text-ink-950'
                      : i < step
                        ? 'border-flux-400/60'
                        : 'border-bone-500'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="hidden text-sm font-medium md:inline">
                  {s.replace(/^\d+\s/, '')}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px w-4 shrink-0 sm:w-10 ${i < step ? 'bg-flux-400/60' : 'bg-bone-600/60'}`}
                />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-bone-300">
          Step {step + 1} of {steps.length}: <span className="text-bone-50">{steps[step].replace(/^\d+\s/, '')}</span>
        </p>

        {/* Step content */}
        {/* overflow-x-clip, not hidden: the slide transition below animates from
            x:30, and letting a decorative transform widen the document put a
            15px horizontal scroll on every phone. Clip does not create a scroll
            container, so nothing inside loses position: sticky. */}
        <div className="mt-6 overflow-x-clip border border-bone-600/30 bg-ink-900 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
            >
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm font-medium text-bone-100">How should Aegis test it?</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {([
                        { mode: 'simulation' as const, icon: FlaskConical, title: 'Prompt simulation', detail: 'Aegis runs the prompt and tools through the evaluator model. Fastest way to establish a low-cost baseline.' },
                        { mode: 'connected' as const, icon: Cable, title: 'Connected agent', detail: 'Aegis calls your runner so retrieval, memory and orchestration are included in the test.' },
                      ]).map((option) => (
                        <button key={option.mode} type="button"
                          aria-pressed={form.connectionMode === option.mode}
                          onClick={() => update('connectionMode', option.mode)}
                          className={`border p-4 text-left transition-colors ${form.connectionMode === option.mode ? 'border-signal-400 bg-signal-500/10' : 'border-bone-600/40 bg-ink-950 hover:border-bone-300/60'}`}>
                          <option.icon className={`h-5 w-5 ${form.connectionMode === option.mode ? 'text-signal-300' : 'text-bone-400'}`} />
                          <span className="mt-3 block text-base font-medium text-bone-50">{option.title}</span>
                          <span className="mt-1 block text-sm leading-relaxed text-bone-300">{option.detail}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.connectionMode === 'connected' && (
                    <div className="space-y-4">
                      <div>
                      <label htmlFor="agent-endpoint" className="text-sm font-medium text-bone-100 mb-2 block">Runner endpoint</label>
                      <input id="agent-endpoint" type="url" className={inputClass}
                        placeholder="https://agent.example.com/aegis/action"
                        value={form.endpointUrl} onChange={(event) => update('endpointUrl', event.target.value)} />
                      <p className="mt-2 text-sm leading-relaxed text-bone-300">
                        Use a dedicated HTTPS endpoint implementing the Aegis runner contract. Do not put a token in this URL; authenticate at your gateway or private network boundary.
                      </p>
                      </div>
                      <div>
                        <label htmlFor="agent-runner-token" className="text-sm font-medium text-bone-100 mb-2 block">Bearer token <span className="text-bone-400">(optional)</span></label>
                        <input id="agent-runner-token" type="password" autoComplete="new-password"
                          className={inputClass} placeholder="Stored encrypted; never returned"
                          value={runnerToken} onChange={(event) => setRunnerToken(event.target.value)} />
                        <p className="mt-2 text-sm leading-relaxed text-bone-300">
                          The token is encrypted by the API and injected only by the worker. It is excluded from reports, version snapshots and browser drafts.
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label htmlFor="agent-name" className="text-sm font-medium text-bone-100 mb-2 block">Agent name
                    </label>
                    <input
                      id="agent-name"
                      maxLength={200}
                      className={inputClass}
                      placeholder="e.g. Customer Support Agent"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="agent-desc" className="text-sm font-medium text-bone-100 mb-2 block">Description
                    </label>
                    <textarea
                      id="agent-desc"
                      className={`${inputClass} h-24 resize-none`}
                      placeholder="What does this agent do?"
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="agent-domain" className="text-sm font-medium text-bone-100 mb-2 block">Domain
                    </label>
                    <input
                      id="agent-domain"
                      className={inputClass}
                      placeholder="e.g. customer support"
                      value={form.domain}
                      onChange={(e) => update('domain', e.target.value)}
                    />
                    <p className="mt-2 text-sm leading-relaxed text-bone-300">
                      Aegis infers the domain from the system prompt. This is only a hint for
                      you; it is not stored on the agent.
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <label htmlFor="agent-prompt" className="text-sm font-medium text-bone-100 mb-2 block">System prompt
                  </label>
                  <textarea
                    id="agent-prompt"
                    className={`${inputClass} h-64 resize-none`}
                    placeholder="You are a... Always verify... Never..."
                    value={form.systemPrompt}
                    onChange={(e) => update('systemPrompt', e.target.value)}
                  />
                  <p className="mt-2 text-sm leading-relaxed text-bone-300">
                    {form.systemPrompt.length} characters · adversarial coverage improves with
                    explicit constraints. State hard rules ("never refund above $500 without
                    approval") and escalation paths, so safety scenarios have a correct answer.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-sm font-medium text-bone-100">Available tools</h2>

                  {/* Nobody has their tools as a form. They have a schema. */}
                  <div className="border border-dashed border-bone-600/50 bg-ink-950 p-4">
                    <h3 className="text-base font-medium text-bone-50">
                      Import a tool schema
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-bone-300">
                      Paste an OpenAI <code className="text-signal-300">tools</code> array, an
                      Anthropic/MCP tool list or a name-to-definition map, or upload the .json
                      file. Argument schemas are kept, so generated scenarios call your tools with
                      the arguments they really take.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
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
                            // Clear first: leaving the rejected file selected means
                            // picking it again fires no change event at all.
                            event.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const text = String(reader.result ?? '');
                            setSchemaText(text);
                            importSchema(text);
                          };
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
                        <Upload className="h-4 w-4" aria-hidden /> Upload JSON file
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSchema((v) => !v)}
                        className={buttonSecondary}
                      >
                        <ClipboardPaste className="h-4 w-4" aria-hidden />
                        {showSchema ? 'Hide' : 'Paste schema'}
                      </button>
                      <button
                        type="button"
                        onClick={copyToolsOut}
                        className="flex min-h-11 items-center px-2 text-sm text-bone-300 underline-offset-4 transition-colors hover:text-bone-50 hover:underline"
                      >Copy current tools out
                      </button>
                    </div>

                    {showSchema && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          aria-label="Tool schema JSON"
                          rows={8}
                          value={schemaText}
                          onChange={(e) => setSchemaText(e.target.value)}
                          placeholder={SCHEMA_PLACEHOLDER}
                          className={`${inputClass} resize-y font-mono`}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => importSchema(schemaText)}
                            className={buttonPrimary}
                          >Import tools
                          </button>
                          {schemaErrors.length > 0 && (
                            <span className="text-sm text-fault-300">
                              {schemaErrors.slice(0, 2).join(' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {form.tools.map((tool, i) => (
                    <div key={i} className="border border-bone-600/40 bg-ink-950 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-bone-100">
                          Tool {i + 1}
                          {tool.parameters && (
                            <span className="ml-2 text-flux-400">· schema imported</span>
                          )}
                        </span>
                        {form.tools.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove tool ${i + 1}`}
                            onClick={() => removeTool(i)}
                            className="-m-2 flex h-11 w-11 items-center justify-center text-bone-300 transition-colors hover:text-fault-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {/* A placeholder is not a label: it disappears on focus and
                          screen readers announce nothing for these fields. */}
                      <input
                        aria-label={`Tool ${i + 1} name`}
                        className={`${inputClass} mt-3 font-mono`}
                        placeholder="function_name()"
                        value={tool.name}
                        onChange={(e) => updateTool(i, 'name', e.target.value)}
                      />
                      <input
                        aria-label={`Tool ${i + 1} description`}
                        className={`${inputClass} mt-2`}
                        placeholder="What does this tool do?"
                        value={tool.description}
                        onChange={(e) => updateTool(i, 'description', e.target.value)}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-sm text-bone-200">Risk level</span>
                        <button
                          type="button"
                          aria-pressed={!tool.risk}
                          title="Aegis infers the risk from the tool's name and description"
                          onClick={() => setToolRisk(i, undefined)}
                          className={`flex min-h-11 items-center border px-3 text-sm capitalize transition-colors ${
                            !tool.risk ? 'border-signal-400 bg-signal-500/10 text-signal-300' : 'border-bone-600/50 text-bone-200'
                          }`}
                        >
                          auto
                        </button>
                        {(['low', 'medium', 'high'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={tool.risk === r}
                            onClick={() => setToolRisk(i, r)}
                            className={`flex min-h-11 items-center border px-3 text-sm capitalize transition-colors ${
                              tool.risk === r
                                ? r === 'high'
                                  ? 'border-fault-500/50 text-fault-400'
                                  : r === 'medium'
                                    ? 'border-warn-500/50 text-warn-400'
                                    : 'border-flux-500/50 text-flux-400'
                                : 'border-bone-600/50 text-bone-200'
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
                    onClick={addTool}
                    className={`${buttonSecondary} w-full`}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Add tool
                  </button>
                  {toolsError && <p role="alert" className="text-sm text-warn-300">{toolsError}</p>}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    {[
                      { label: 'Agent name', value: form.name || '—' },
                      { label: 'Test path', value: form.connectionMode === 'connected' ? `Connected runner · ${form.endpointUrl}` : 'Prompt simulation' },
                      ...(form.connectionMode === 'connected' ? [{ label: 'Runner auth', value: runnerToken ? 'Encrypted bearer token' : 'Gateway / network boundary' }] : []),
                      { label: 'Description', value: form.description || '—' },
                      { label: 'Domain', value: form.domain || '—' },
                      { label: 'System prompt', value: form.systemPrompt || '—' },
                      {
                        label: 'Tools',
                        value:
                          form.tools
                            .filter((t) => t.name)
                            .map((t) => `${t.name}${t.parameters ? ' (schema)' : ''}`)
                            .join(', ') || '—',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col gap-1 border-b border-bone-600/30 py-3 first:pt-0 last:border-0 md:flex-row md:gap-8"
                      >
                        <span className="w-40 shrink-0 text-sm text-bone-300">{item.label}</span>
                        <span className="min-w-0 whitespace-pre-wrap break-words text-sm text-bone-50">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-bone-300">
                    On create, Aegis profiles the system prompt and tool schema and derives a
                    scenario suite from it. No evaluation runs until you start one.
                  </p>
                  {submitError && (
                    <p role="alert" className="border border-fault-500/50 bg-fault-500/5 px-4 py-3 text-sm text-fault-300">
                      {submitError}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation: Back on the left, everything that moves forward on the right. */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className={buttonSecondary}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
          ) : (
            <Link to="/app/agents" className={buttonSecondary}>Cancel</Link>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={saveDraft} className={buttonSecondary}>
              <Save className="h-4 w-4" aria-hidden /> Save draft
            </button>

            {step < 3 ? (
              <button type="button" disabled={!canProceed()} onClick={() => setStep(step + 1)} className={buttonPrimary}>
                Continue <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || Boolean(toolsError) || !form.name.trim() || !form.systemPrompt.trim()}
                className={buttonPrimary}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Creating…
                  </>
                ) : (
                  <>
                    Create agent <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        </div>
    </div>
  );
}
