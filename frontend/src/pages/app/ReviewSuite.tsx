import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Play, Trash2 } from 'lucide-react';
import { AppNavigation } from '@/components/AppNavigation';
import { ErrorState, LoadingState } from '@/components/AsyncState';
import { SystemLabel } from '@/components/SystemLabel';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api, ApiError, type ScenarioContractDraft } from '@/lib/api';
import { runOptionsFor } from '@/lib/workspace-settings';

type ReviewRow = ScenarioContractDraft & {
  fingerprint: string;
  expectedJson: string;
};

function parseExpected(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export default function ReviewSuite() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const agent = useResource(() => api.agent(id as string), [id], { enabled: Boolean(id) });
  const versionLabel = `v${(agent.data?.versions.length ?? 0) + 1}`;
  const defaults = useMemo(() => runOptionsFor(versionLabel), [versionLabel]);
  const preview = useResource(
    () => api.previewSuite(id as string, {
      perCategory: defaults.perCategory,
      adversarial: defaults.adversarial,
    }),
    [id, defaults.perCategory, defaults.adversarial],
    { enabled: Boolean(id && agent.data) },
  );
  const billing = useResource(() => api.billing(), [id], { enabled: Boolean(agent.data) });
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!preview.data) return;
    setRows(preview.data.scenarios.map((scenario) => ({
      ...scenario,
      expectedJson: JSON.stringify(scenario.expectedBehavior, null, 2),
    })));
  }, [preview.data]);

  const invalid = (rows ?? []).some((row) => (
    !row.name.trim() || !row.initialPrompt.trim() || !parseExpected(row.expectedJson)
  ));

  const update = (index: number, patch: Partial<ReviewRow>) => {
    setRows((current) => current?.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )) ?? null);
  };

  const start = async () => {
    if (!agent.data || !rows?.length || invalid) return;
    setStarting(true);
    try {
      const scenarios = rows.map((row) => ({
        name: row.name,
        category: row.category,
        subtype: row.subtype,
        initialPrompt: row.initialPrompt,
        expectedBehavior: parseExpected(row.expectedJson)!,
        difficulty: row.difficulty,
        injectedContent: row.injectedContent,
      }));
      const created = await api.evaluate(agent.data.id, {
        ...defaults,
        ...(agent.data.connection.mode === 'connected'
          ? { adapter: 'http' as const, url: agent.data.connection.url }
          : {}),
        scenarios,
      });
      toast.success(`${created.total} reviewed scenarios queued`, 'This exact dataset is saved with the evaluation.');
      navigate(`/app/evaluations/${created.evaluationId}/running`);
    } catch (cause) {
      toast.error('Evaluation not started', cause instanceof ApiError ? cause.message : 'Try again.');
      setStarting(false);
    }
  };

  if (agent.loading || preview.loading) {
    return <div className="min-h-screen bg-ink-950"><AppNavigation /><LoadingState label="GENERATING TEST CONTRACT" /></div>;
  }
  if (agent.error || preview.error || !agent.data || !rows) {
    return (
      <div className="min-h-screen bg-ink-950">
        <AppNavigation />
        <div className="px-6 py-16 md:px-10">
          <ErrorState message={agent.error ?? preview.error ?? 'The test contract could not be generated.'}
            onRetry={() => { agent.reload(); preview.reload(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />
      <main className="px-4 py-8 sm:px-6 md:px-10">
        <Link to={`/app/agents/${agent.data.id}`}
          className="inline-flex min-h-10 items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-bone-500 hover:text-bone-200">
          <ArrowLeft className="h-4 w-4" /> BACK TO {agent.data.name}
        </Link>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SystemLabel>DATASET / {versionLabel}</SystemLabel>
            <h1 className="massive mt-2 text-[clamp(2.5rem,6vw,4.5rem)] text-bone-50">REVIEW BEFORE RUN.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bone-400">
              Correct the prompts and expected behavior now. Starting the evaluation stores this exact contract and its fingerprint, so later comparisons cannot silently grade a different test.
            </p>
          </div>
          <div className="border border-bone-600/25 bg-ink-900/60 px-5 py-4 text-sm text-bone-300">
            <span className="font-mono text-signal-300">{rows.length}</span> scenario credits
            {billing.data && <span className="ml-2 text-bone-500">· {billing.data.remaining} remaining</span>}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {rows.map((row, index) => {
            const expectedValid = Boolean(parseExpected(row.expectedJson));
            return (
              <section key={`${row.fingerprint}-${index}`} className="border border-bone-600/20 bg-ink-900/55 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-signal-400">{String(index + 1).padStart(2, '0')}</span>
                  <select value={row.category}
                    onChange={(event) => update(index, { category: event.target.value as ReviewRow['category'] })}
                    className="min-h-10 border border-bone-600/30 bg-ink-950 px-3 font-mono text-[10px] uppercase text-bone-300">
                    {preview.data?.categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <span className="font-mono text-[10px] text-bone-600">{row.subtype}</span>
                  <button type="button" aria-label={`Remove ${row.name}`}
                    onClick={() => setRows((current) => current?.filter((_, rowIndex) => rowIndex !== index) ?? null)}
                    className="ml-auto flex h-10 w-10 items-center justify-center text-bone-500 hover:text-fault-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <label className="mt-4 block text-xs text-bone-400">
                  Scenario title
                  <input value={row.name} maxLength={300}
                    onChange={(event) => update(index, { name: event.target.value })}
                    className="mt-2 min-h-11 w-full border border-bone-600/30 bg-ink-950 px-4 text-sm text-bone-100 outline-none focus:border-signal-500/50" />
                </label>
                <label className="mt-4 block text-xs text-bone-400">
                  User prompt
                  <textarea value={row.initialPrompt} maxLength={12000}
                    onChange={(event) => update(index, { initialPrompt: event.target.value })}
                    className="mt-2 min-h-28 w-full resize-y border border-bone-600/30 bg-ink-950 p-4 text-sm leading-relaxed text-bone-100 outline-none focus:border-signal-500/50" />
                </label>
                <label className="mt-4 block text-xs text-bone-400">
                  Expected behavior (JSON)
                  <textarea value={row.expectedJson}
                    onChange={(event) => update(index, { expectedJson: event.target.value })}
                    className={`mt-2 min-h-40 w-full resize-y border bg-ink-950 p-4 font-mono text-xs leading-relaxed text-bone-200 outline-none ${expectedValid ? 'border-bone-600/30 focus:border-signal-500/50' : 'border-fault-500/60'}`} />
                </label>
                {!expectedValid && <p role="alert" className="mt-2 text-xs text-fault-400">Expected behavior must be a JSON object.</p>}
              </section>
            );
          })}
        </div>

        {rows.length === 0 && (
          <p className="mt-8 border border-fault-500/30 bg-fault-500/5 p-5 text-sm text-fault-300">
            Keep at least one scenario in the reviewed dataset.
          </p>
        )}
        <div className="sticky bottom-0 mt-8 flex flex-col gap-3 border-t border-bone-600/25 bg-ink-950/95 py-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-bone-500">
            No credits are used until you start. A connected agent runs against its configured runner; prompt simulation uses the workspace model setting.
          </p>
          <button type="button" onClick={() => void start()}
            disabled={starting || invalid || rows.length === 0}
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 border border-signal-500/50 bg-signal-500/15 px-6 font-mono text-xs uppercase tracking-wider text-signal-300 disabled:opacity-40">
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {starting ? 'RESERVING CREDITS…' : `RUN ${rows.length} SCENARIOS`}
          </button>
        </div>
      </main>
    </div>
  );
}
