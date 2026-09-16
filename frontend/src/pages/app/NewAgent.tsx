import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppNavigation } from '@/components/AppNavigation';
import { SystemLabel } from '@/components/SystemLabel';
import { MassiveHeading } from '@/components/MassiveHeading';
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

  const update = (key: keyof AgentForm, value: string | ToolDraft[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateTool = (i: number, key: keyof ToolDraft, value: string) => {
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)),
    }));
  };

  const addTool = () => {
    setForm((prev) => ({
      ...prev,
      tools: [...prev.tools, { name: '', description: '', risk: 'low' }],
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
        // Risk is only a hint here; the backend re-derives it from the tool's verb.
        risk: tool.risk ?? 'low',
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
    if (step === 0) return Boolean(form.name.trim()) && form.name.trim().length <= 200;
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
            risk: t.risk,
            ...(t.parameters ? { parameters: t.parameters } : {}),
          })),
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
  const inputClass =
    'w-full border border-bone-300/35 bg-ink-900/60 px-4 py-3 font-mono text-base sm:text-sm text-bone-50 placeholder:text-bone-300 focus:border-signal-400/70 focus:outline-none transition-colors';

  return (
    <div className="min-h-screen bg-ink-950 new-agent-page">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>NEW AGENT / CONFIGURATION</SystemLabel>
        <MassiveHeading
          lines={['DEFINE', 'THE AGENT.']}
          className="mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50"
        />

        {/* Progress */}
        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3 sm:gap-x-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-3 sm:gap-4">
              {/* Steps already visited are reachable again: a four-step form that
                  only moves forwards makes a typo on step 1 a restart. */}
              {/* 24px circles are not a tap target. The button carries the
                  minimum touch size around them rather than growing the dot. */}
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${s.replace(/^\d+\s/, '')}`}
                className={`-mx-1.5 flex min-h-11 min-w-9 items-center justify-center gap-2 px-1.5 disabled:cursor-default ${
                  i === step ? 'text-signal-300' : i < step ? 'text-flux-300' : 'text-bone-300'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                    i === step
                      ? 'border-signal-400 bg-signal-500/15 shadow-[0_0_14px_rgba(91,200,232,0.18)]'
                      : i < step
                        ? 'border-flux-500/40'
                        : 'border-bone-300/45'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="hidden font-mono text-[11px] uppercase tracking-wider md:inline">
                  {s}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-4 sm:w-8 ${i < step ? 'bg-flux-400/50' : 'bg-bone-300/25'}`}
                />
              )}
            </div>
          ))}
          <span className="w-full font-mono text-xs text-bone-300 sm:ml-auto sm:w-auto">
            STEP {String(step + 1).padStart(2, '0')} / 04
          </span>
        </div>

        {/* Step content */}
        {/* overflow-x-clip, not hidden: the slide transition below animates from
            x:30, and letting a decorative transform widen the document put a
            15px horizontal scroll on every phone. Clip does not create a scroll
            container, so nothing inside loses position: sticky. */}
        <div className="mt-12 max-w-2xl overflow-x-clip">
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
                    <label htmlFor="agent-name" className="tech-label mb-2 block text-bone-300">
                      AGENT NAME
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
                    <label htmlFor="agent-desc" className="tech-label mb-2 block text-bone-300">
                      DESCRIPTION
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
                    <label htmlFor="agent-domain" className="tech-label mb-2 block text-bone-300">
                      DOMAIN
                    </label>
                    <input
                      id="agent-domain"
                      className={inputClass}
                      placeholder="e.g. customer support"
                      value={form.domain}
                      onChange={(e) => update('domain', e.target.value)}
                    />
                    <p className="mt-2 font-mono text-[10px] text-bone-300">
                      Aegis infers the domain from the system prompt. This is only a hint for
                      you — it is not stored on the agent.
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <label htmlFor="agent-prompt" className="tech-label mb-2 block text-bone-300">
                    SYSTEM PROMPT
                  </label>
                  <textarea
                    id="agent-prompt"
                    className={`${inputClass} h-64 resize-none`}
                    placeholder="You are a... Always verify... Never..."
                    value={form.systemPrompt}
                    onChange={(e) => update('systemPrompt', e.target.value)}
                  />
                  <p className="mt-2 font-mono text-[10px] text-bone-300">
                    {form.systemPrompt.length} characters · adversarial coverage improves with
                    explicit constraints. State hard rules ("never refund above $500 without
                    approval") and escalation paths, so safety scenarios have a correct answer.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <SystemLabel className="block !text-bone-300">AVAILABLE TOOLS</SystemLabel>

                  {/* Nobody has their tools as a form. They have a schema. */}
                  <div className="border border-dashed border-bone-600/35 bg-ink-900/40 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-bone-200">
                      Import a tool schema
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-bone-400">
                      Paste an OpenAI <code className="text-signal-300">tools</code> array, an
                      Anthropic/MCP tool list, or a name-to-definition map — or upload the .json
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
                        className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-3 font-mono text-[11px] uppercase tracking-wider text-bone-200 transition-colors hover:border-signal-400/50 hover:text-signal-300"
                      >
                        <Upload className="h-3.5 w-3.5" /> UPLOAD .JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSchema((v) => !v)}
                        className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-3 font-mono text-[11px] uppercase tracking-wider text-bone-200 transition-colors hover:border-signal-400/50 hover:text-signal-300"
                      >
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        {showSchema ? 'HIDE' : 'PASTE SCHEMA'}
                      </button>
                      <button
                        type="button"
                        onClick={copyToolsOut}
                        className="flex min-h-11 items-center px-2 font-mono text-[11px] uppercase tracking-wider text-bone-400 transition-colors hover:text-bone-100"
                      >
                        COPY CURRENT TOOLS OUT
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
                          className={`${inputClass} resize-y text-xs`}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => importSchema(schemaText)}
                            className="flex min-h-11 items-center border border-signal-500/40 bg-signal-500/10 px-4 font-mono text-[11px] uppercase tracking-wider text-signal-300 transition-colors hover:bg-signal-500/20"
                          >
                            IMPORT TOOLS
                          </button>
                          {schemaErrors.length > 0 && (
                            <span className="font-mono text-[10px] text-fault-400">
                              {schemaErrors.slice(0, 2).join(' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {form.tools.map((tool, i) => (
                    <div key={i} className="border border-bone-300/25 bg-ink-900/60 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-bone-300">
                          TOOL {String(i + 1).padStart(2, '0')}
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
                        className={`${inputClass} mt-3`}
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
                        <SystemLabel className="!text-bone-300">RISK LEVEL</SystemLabel>
                        {(['low', 'medium', 'high'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={tool.risk === r}
                            onClick={() => updateTool(i, 'risk', r)}
                            className={`flex min-h-9 items-center border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors ${
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
                    onClick={addTool}
                    className="flex w-full items-center justify-center gap-2 border border-dashed border-bone-600/30 py-3 font-mono text-xs uppercase tracking-wider text-bone-300 transition-colors hover:border-signal-400/50 hover:text-signal-300"
                  >
                    <Plus className="h-4 w-4" /> ADD TOOL
                  </button>
                  {toolsError && <p role="alert" className="font-mono text-xs text-warn-400">{toolsError}</p>}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="border border-bone-300/25 bg-ink-900/60 p-4 sm:p-6">
                    {[
                      { label: 'AGENT NAME', value: form.name || '—' },
                      { label: 'DESCRIPTION', value: form.description || '—' },
                      { label: 'DOMAIN', value: form.domain || '—' },
                      { label: 'SYSTEM PROMPT', value: form.systemPrompt || '—' },
                      {
                        label: 'TOOLS',
                        value:
                          form.tools
                            .filter((t) => t.name)
                            .map((t) => `${t.name}${t.parameters ? ' (schema)' : ''}`)
                            .join(', ') || '—',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col gap-1 border-b border-bone-300/25 py-3 last:border-0 md:flex-row md:gap-8"
                      >
                        <span className="tech-label w-40 shrink-0">{item.label}</span>
                        <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-sm text-bone-100">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-bone-300">
                    On create, Aegis profiles the system prompt and tool schema and derives a
                    scenario suite from it. No evaluation runs until you start one.
                  </p>
                  {submitError && (
                    <p className="border border-fault-500/40 bg-fault-500/5 px-4 py-3 font-mono text-[11px] text-fault-300">
                      {submitError}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-wider text-bone-300 transition-colors hover:text-bone-50"
            >
              <ArrowLeft className="h-4 w-4" /> BACK
            </button>
          ) : (
            <div />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveDraft}
              className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-4 font-mono text-xs uppercase tracking-wider text-bone-300 transition-colors hover:border-bone-400 hover:text-bone-100"
            >
              <Save className="h-3.5 w-3.5" /> SAVE DRAFT
            </button>

            {step < 3 ? (
              <button
                type="button"
                disabled={!canProceed()}
                onClick={() => setStep(step + 1)}
                className="group flex min-h-11 items-center gap-2 border border-signal-500/40 bg-signal-500/10 px-6 font-mono text-xs uppercase tracking-wider text-signal-400 transition-colors enabled:hover:bg-signal-500/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                CONTINUE{' '}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || Boolean(toolsError) || !form.name.trim() || !form.systemPrompt.trim()}
                className="group flex min-h-11 items-center gap-2 border border-signal-500 bg-signal-500/20 px-6 font-mono text-xs uppercase tracking-wider text-signal-300 transition-colors enabled:hover:bg-signal-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> CREATING…
                  </>
                ) : (
                  <>
                    CREATE AGENT{' '}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
