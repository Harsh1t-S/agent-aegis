import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppNavigation } from '@/components/AppNavigation';
import { SystemLabel } from '@/components/SystemLabel';
import { MassiveHeading } from '@/components/MassiveHeading';
import { ArrowRight, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, type ToolDraft } from '@/lib/api';

const steps = ['01 Identity', '02 Instructions', '03 Tools', '04 Review'];

interface FormData {
  name: string;
  description: string;
  domain: string;
  systemPrompt: string;
  tools: ToolDraft[];
}

export default function NewAgent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    domain: '',
    systemPrompt: '',
    tools: [{ name: '', description: '', risk: 'low' }],
  });

  const update = (key: keyof FormData, value: string | ToolDraft[]) => {
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
    setForm((prev) => ({
      ...prev,
      tools: prev.tools.filter((_, idx) => idx !== i),
    }));
  };

  const canProceed = () => {
    if (step === 0) return Boolean(form.name.trim());
    if (step === 1) return Boolean(form.systemPrompt.trim());
    if (step === 2) return form.tools.some((t) => t.name.trim());
    return true;
  };

  const handleSubmit = async () => {
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
          })),
      });
      navigate(`/app/agents/${agent.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not create the agent.',
      );
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-bone-300/35 bg-ink-900/60 px-4 py-3 font-mono text-sm text-bone-50 placeholder:text-bone-300 focus:border-violet-400/70 focus:outline-none transition-colors';

  return (
    <div className="min-h-screen bg-ink-950 new-agent-page">
      <AppNavigation />

      <div className="px-6 py-8 md:px-10">
        <SystemLabel>NEW AGENT / CONFIGURATION</SystemLabel>
        <MassiveHeading
          lines={['DEFINE', 'THE AGENT.']}
          className="mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50"
        />

        {/* Progress */}
        <div className="mt-8 flex items-center gap-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 ${
                  i === step ? 'text-violet-300' : i < step ? 'text-flux-300' : 'text-bone-300'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                    i === step
                      ? 'border-violet-400 bg-violet-500/15 shadow-[0_0_14px_rgba(139,92,246,0.18)]'
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
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px w-8 ${i < step ? 'bg-flux-400/50' : 'bg-bone-300/25'}`} />
              )}
            </div>
          ))}
          <span className="ml-auto font-mono text-xs text-bone-300">
            STEP {String(step + 1).padStart(2, '0')} / 04
          </span>
        </div>

        {/* Step content */}
        <div className="mt-12 max-w-2xl">
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
                    <SystemLabel className="mb-2 block !text-bone-300">AGENT NAME</SystemLabel>
                    <input
                      className={inputClass}
                      placeholder="e.g. Customer Support Agent"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <SystemLabel className="mb-2 block !text-bone-300">DESCRIPTION</SystemLabel>
                    <textarea
                      className={`${inputClass} h-24 resize-none`}
                      placeholder="What does this agent do?"
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                    />
                  </div>
                  <div>
                    <SystemLabel className="mb-2 block !text-bone-300">DOMAIN</SystemLabel>
                    <input
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
                  <SystemLabel className="mb-2 block !text-bone-300">SYSTEM PROMPT</SystemLabel>
                  <textarea
                    className={`${inputClass} h-64 resize-none`}
                    placeholder="You are a... Always verify... Never..."
                    value={form.systemPrompt}
                    onChange={(e) => update('systemPrompt', e.target.value)}
                  />
                  <p className="mt-2 font-mono text-[10px] text-bone-300">
                    The system prompt defines the agent's behavior, constraints, and persona.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <SystemLabel className="block !text-bone-300">AVAILABLE TOOLS</SystemLabel>
                  {form.tools.map((tool, i) => (
                    <div key={i} className="border border-bone-300/25 bg-ink-900/60 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-bone-300">TOOL {String(i + 1).padStart(2, '0')}</span>
                        {form.tools.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTool(i)}
                            className="text-bone-300 hover:text-fault-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <input
                        className={`${inputClass} mt-3`}
                        placeholder="function_name()"
                        value={tool.name}
                        onChange={(e) => updateTool(i, 'name', e.target.value)}
                      />
                      <input
                        className={`${inputClass} mt-2`}
                        placeholder="What does this tool do?"
                        value={tool.description}
                        onChange={(e) => updateTool(i, 'description', e.target.value)}
                      />
                      <div className="mt-3 flex items-center gap-3">
                        <SystemLabel className="!text-bone-300">RISK LEVEL</SystemLabel>
                        {(['low', 'medium', 'high'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => updateTool(i, 'risk', r)}
                            className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
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
                    className="flex w-full items-center justify-center gap-2 border border-dashed border-bone-600/30 py-3 font-mono text-xs uppercase tracking-wider text-bone-300 transition-colors hover:border-violet-400/50 hover:text-violet-300"
                  >
                    <Plus className="h-4 w-4" /> ADD TOOL
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="border border-bone-300/25 bg-ink-900/60 p-6">
                    {[
                      { label: 'AGENT NAME', value: form.name || '—' },
                      { label: 'DESCRIPTION', value: form.description || '—' },
                      { label: 'DOMAIN', value: form.domain || '—' },
                      { label: 'SYSTEM PROMPT', value: form.systemPrompt || '—' },
                      {
                        label: 'TOOLS',
                        value: form.tools.filter((t) => t.name).map((t) => t.name).join(', ') || '—',
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col gap-1 border-b border-bone-300/25 py-3 last:border-0 md:flex-row md:gap-8">
                        <span className="tech-label w-40 shrink-0">{item.label}</span>
                        <span className="font-mono text-sm text-bone-100">{item.value}</span>
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
        <div className="mt-12 flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-bone-300 transition-colors hover:text-bone-50"
            >
              <ArrowLeft className="h-4 w-4" /> BACK
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              disabled={!canProceed()}
              onClick={() => setStep(step + 1)}
              className="group flex items-center gap-2 border border-violet-500/40 bg-violet-500/10 px-6 py-3 font-mono text-xs uppercase tracking-wider text-violet-400 transition-colors enabled:hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              CONTINUE <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim() || !form.systemPrompt.trim()}
              className="group flex items-center gap-2 border border-violet-500 bg-violet-500/20 px-6 py-3 font-mono text-xs uppercase tracking-wider text-violet-300 transition-colors enabled:hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
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
  );
}
