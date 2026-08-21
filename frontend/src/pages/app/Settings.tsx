import { AppNavigation } from '@/components/AppNavigation';
import { SystemLabel } from '@/components/SystemLabel';
import { MassiveHeading } from '@/components/MassiveHeading';
import { AsyncBoundary } from '@/components/AsyncState';
import { useToast } from '@/components/Toaster';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';
import {
  DEFAULT_SETTINGS,
  perCategoryFor,
  useWorkspaceSettings,
} from '@/lib/workspace-settings';
import { RotateCcw } from 'lucide-react';

/**
 * Every control here changes what the app does.
 *
 * "Regression alerts" and "auto re-run on failure" used to sit alongside these and
 * changed nothing at all — there is no mailer and no post-run hook behind them —
 * so they are absent rather than present as switches nobody reads. A settings
 * screen full of inert toggles is the fastest way to make a working product look
 * like a mock.
 */
export default function Settings() {
  const { settings, update, reset } = useWorkspaceSettings();
  const scoring = useResource(() => api.scoring(), []);
  const toast = useToast();

  const perCategory = perCategoryFor(settings.scenariosPerRun);
  const actual = perCategory * (settings.adversarial ? 4 : 3);

  return (
    <div className="min-h-screen bg-ink-950">
      <AppNavigation />

      <div className="px-4 py-8 sm:px-6 md:px-10">
        <SystemLabel>WORKSPACE / DEFAULTS</SystemLabel>
        <MassiveHeading
          lines={['EVALUATION', 'DEFAULTS.']}
          className="mt-2 text-[clamp(2rem,6vw,4rem)] text-bone-50"
        />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-400">
          These apply to every evaluation started from the console. There are no
          accounts, so they are stored in this browser and do not follow you to another
          device.
        </p>

        <div className="mt-10 grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>SUITE SIZE</SystemLabel>
            <label htmlFor="scenarios" className="mt-4 block text-sm text-bone-300">
              Scenarios per run
            </label>
            <input
              id="scenarios"
              type="number"
              min={4}
              max={40}
              value={settings.scenariosPerRun}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) return;
                update({ scenariosPerRun: Math.max(4, Math.min(40, Math.round(raw))) });
              }}
              className="mt-2 w-full border border-bone-300/35 bg-ink-950/60 px-4 py-3 font-mono text-base text-bone-50 focus:border-violet-400/70 focus:outline-none sm:text-sm"
            />
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-bone-500">
              Scenarios are generated per category, so the number is rounded to a whole
              number per category. At {settings.scenariosPerRun} this run generates{' '}
              <span className="text-bone-200">{perCategory} per category</span> across{' '}
              {settings.adversarial ? 'four' : 'three'} categories —{' '}
              <span className="text-bone-200">about {actual} scenarios</span>. Saying "12"
              and silently running 8 is exactly the kind of gap this product exists to
              catch.
            </p>
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>ADVERSARIAL COVERAGE</SystemLabel>
            <button
              type="button"
              role="switch"
              aria-checked={settings.adversarial}
              onClick={() => update({ adversarial: !settings.adversarial })}
              className="mt-4 flex w-full items-center justify-between gap-4 border border-bone-600/25 bg-ink-950/40 p-4 text-left transition-colors hover:border-violet-500/40"
            >
              <span className="min-w-0">
                <span className="block text-sm text-bone-100">Adversarial scenarios</span>
                <span className="mt-1 block text-xs leading-relaxed text-bone-400">
                  Inject prompt-injection, jailbreak and contradictory-instruction variants
                  into every run.
                </span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  settings.adversarial
                    ? 'border-violet-500/60 bg-violet-500/25'
                    : 'border-bone-600/40 bg-ink-850'
                }`}
              >
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                    settings.adversarial
                      ? 'left-[calc(100%-1.25rem)] bg-violet-300'
                      : 'left-1 bg-bone-500'
                  }`}
                />
              </span>
            </button>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-bone-500">
              This gates scenario <span className="text-bone-200">generation</span>, not the
              agent under test. Turning it off removes the hardest scenarios, so the score
              goes <span className="text-bone-200">up</span> — that is the honest reading,
              not an improvement.
            </p>
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>AGENT UNDER TEST</SystemLabel>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    key: 'behavioral' as const,
                    title: 'Behavioral stand-in',
                    detail:
                      'A deterministic scripted agent. Same trace every time, so a demo and a regression diff are reproducible.',
                  },
                  {
                    key: 'llm' as const,
                    title: 'Real model',
                    detail:
                      'Runs the scenarios against a live LLM through the configured provider pool. Slower, non-deterministic, and the real thing.',
                  },
                ]
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={settings.adapter === option.key}
                  onClick={() => update({ adapter: option.key })}
                  className={`min-w-0 border p-4 text-left transition-colors ${
                    settings.adapter === option.key
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-bone-600/25 hover:border-bone-500/40'
                  }`}
                >
                  <span
                    className={`block font-mono text-[11px] uppercase tracking-wider ${
                      settings.adapter === option.key ? 'text-violet-300' : 'text-bone-300'
                    }`}
                  >
                    {option.title}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-bone-400">
                    {option.detail}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="min-w-0 border border-bone-600/20 bg-ink-900/60 p-5 sm:p-6">
            <SystemLabel>SCORING CONTRACT</SystemLabel>
            <p className="mt-2 text-xs leading-relaxed text-bone-400">
              Published by the API, not configurable here. Weights and severity ceilings are
              part of the contract a result is graded against — a workspace that could move
              them could make any agent look reliable.
            </p>
            <AsyncBoundary
              loading={scoring.loading}
              error={scoring.error}
              onRetry={scoring.reload}
              label="LOADING CONTRACT"
            >
              {scoring.data && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="tech-label text-bone-600">WEIGHTS</p>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(scoring.data.weights).map(([key, weight]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-3 font-mono text-[11px]"
                        >
                          <span className="uppercase tracking-wider text-bone-400">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-bone-100">{Math.round(weight * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="tech-label text-bone-600">SEVERITY CEILINGS</p>
                    <ul className="mt-2 space-y-1">
                      {scoring.data.gates.map((gate) => (
                        <li key={gate.when} className="font-mono text-[11px] text-bone-400">
                          <span className="text-bone-100">≤ {gate.atMost}</span> — {gate.when}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {scoring.data.evaluator && (
                    <div>
                      <p className="tech-label text-bone-600">DEPLOYED EVALUATOR</p>
                      <ul className="mt-2 space-y-1">
                        {(['generator', 'guardrail', 'detector', 'profile'] as const).map(
                          (key) => (
                            <li
                              key={key}
                              className="flex items-center justify-between gap-3 font-mono text-[11px]"
                            >
                              <span className="uppercase tracking-wider text-bone-400">
                                {key}
                              </span>
                              <span className="text-bone-100">
                                {scoring.data!.evaluator![key]}
                              </span>
                            </li>
                          ),
                        )}
                        <li className="flex items-center justify-between gap-3 font-mono text-[11px]">
                          <span className="uppercase tracking-wider text-bone-400">commit</span>
                          <span className="truncate text-bone-100">
                            {scoring.data.evaluator.commit.slice(0, 12)}
                          </span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </AsyncBoundary>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-bone-600/20 pt-6">
          <button
            type="button"
            onClick={() => {
              reset();
              toast.success(
                'Settings reset',
                `Back to ${DEFAULT_SETTINGS.scenariosPerRun} scenarios, adversarial on, behavioral adapter.`,
              );
            }}
            className="flex min-h-11 items-center gap-2 border border-bone-600/35 px-4 font-mono text-[11px] uppercase tracking-wider text-bone-300 transition-colors hover:border-bone-400 hover:text-bone-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> RESET TO DEFAULTS
          </button>
          <p className="font-mono text-[10px] text-bone-600">
            Changes apply immediately — there is no save button, because a setting that has
            to be saved separately is a setting that silently does not apply.
          </p>
        </div>
      </div>
    </div>
  );
}
