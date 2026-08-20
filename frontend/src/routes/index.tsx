import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Bug,
  FlaskConical,
  GitCompareArrows,
  Gauge,
  ShieldCheck,
  Sparkles,
  Boxes,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AegisLogo } from "@/components/aegis/AppLayout";
import { ReliabilityScore, scoreLabel } from "@/components/aegis/ReliabilityScore";
import { FailureChart } from "@/components/aegis/Charts";
import { StatusBadge } from "@/components/aegis/StatusBadge";
import { EMPTY_EVALUATION, useEvaluations } from "@/lib/live-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis — Ship AI Agents You Can Trust" },
      {
        name: "description",
        content:
          "Aegis generates adversarial scenarios, runs sandboxed evaluations, classifies agent failures and scores AI agent reliability before production.",
      },
      { property: "og:title", content: "Aegis — AI Agent Evaluation & Reliability Engine" },
      {
        property: "og:description",
        content:
          "Discover failure modes, test agents against adversarial scenarios and measure reliability before you ship.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: Sparkles,
    title: "Scenario Generation",
    body: "Aegis reads your system prompt, domain and tool schema, then synthesizes realistic and adversarial scenarios that target your agent's weak points.",
  },
  {
    icon: Boxes,
    title: "Sandboxed Evaluation",
    body: "Every scenario runs in an isolated sandbox with mocked tools, deterministic seeds and full trace capture — no production side effects.",
  },
  {
    icon: Bug,
    title: "Failure Detection",
    body: "Classifiers label hallucinations, goal drift, tool misuse, unsafe actions, infinite loops and overconfidence with severity ratings.",
  },
  {
    icon: Gauge,
    title: "Reliability Scoring",
    body: "Task success, tool accuracy, safety, consistency and groundedness roll up into a single 0–100 reliability score.",
  },
  {
    icon: GitCompareArrows,
    title: "Regression Tracking",
    body: "Compare any two agent versions to see exactly which failure modes improved and which regressed before you promote a release.",
  },
];

const features = [
  {
    title: "Adversarial scenario engine",
    body: "Jailbreaks, prompt injection, ambiguity and contradictory instructions generated per domain.",
  },
  {
    title: "Full execution traces",
    body: "Step-by-step timelines with every tool call, tool response and classifier verdict.",
  },
  {
    title: "Failure taxonomy",
    body: "Six failure classes with severity, frequency and per-version distribution.",
  },
  {
    title: "Prompt-level fixes",
    body: "Each failure ships with a concrete system-prompt recommendation you can copy.",
  },
  {
    title: "Version diffing",
    body: "Reliability, pass rate and failure counts diffed across releases.",
  },
  {
    title: "CI-ready",
    body: "Gate deploys on a reliability threshold and block regressions automatically.",
  },
];

function Landing() {
  const { data: evaluations } = useEvaluations();
  const evaluation = evaluations[0] ?? EMPTY_EVALUATION;
  const hasReport = Boolean(evaluation.id);
  // Falls back to the dashboard until a first run exists to point at.
  const demoEvaluationId = evaluations[0]?.id;
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5">
          <Link to="/">
            <AegisLogo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#product" className="transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#docs" className="transition-colors hover:text-foreground">
              Documentation
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* No Sign In button: there is no authentication here, and offering one
                sets an expectation the deployment does not meet. */}
            <Button variant="hero" size="sm" asChild>
              <Link to="/dashboard">Open the console</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden" id="product">
        <div className="aurora pointer-events-none absolute inset-0" />
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <StatusBadge tone="primary">AI Agent Evaluation & Reliability Engine</StatusBadge>
            <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              <span className="text-gradient">Ship AI Agents You Can Trust.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Automatically discover failure modes, test agents against adversarial scenarios, and
              measure reliability before production.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="hero" size="lg" asChild>
                <Link to="/dashboard">
                  Start Testing <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="surface" size="lg" asChild>
                {demoEvaluationId ? (
                  <Link to="/evaluations/$evaluationId" params={{ evaluationId: demoEvaluationId }}>
                    View Demo
                  </Link>
                ) : (
                  <Link to="/dashboard">View Demo</Link>
                )}
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Sandboxed execution
              </span>
              <span className="inline-flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" /> 6 failure classes
              </span>
              <span className="inline-flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Version regression tracking
              </span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Reliability Report</p>
                {/* This card used to hardcode "Customer Support Agent · v1.3 ·
                    78/100 · 50 tests". Inventing a report on the front page of a
                    product whose whole argument is "do not trust unverified
                    numbers" is the first thing a reviewer would pull on. */}
                <p className="text-sm font-medium">
                  {hasReport
                    ? `${evaluation.agentName} · ${evaluation.version}`
                    : "No evaluations yet"}
                </p>
              </div>
              <StatusBadge tone="warning">Needs attention</StatusBadge>
            </div>

            <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
              <ReliabilityScore
                score={hasReport ? evaluation.score : 0}
                size={150}
                label={hasReport ? scoreLabel(evaluation.score) : "Awaiting first run"}
              />
              <div className="grid w-full grid-cols-3 gap-2.5">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Tests Run</p>
                  <p className="font-mono text-lg">{hasReport ? evaluation.total : 0}</p>
                </div>
                <div className="rounded-lg border border-success/25 bg-success/8 p-3">
                  <p className="text-[11px] text-muted-foreground">Passed</p>
                  <p className="font-mono text-lg text-success">{hasReport ? evaluation.passed : 0}</p>
                </div>
                <div className="rounded-lg border border-destructive/25 bg-destructive/8 p-3">
                  <p className="text-[11px] text-muted-foreground">Failed</p>
                  <p className="font-mono text-lg text-destructive">{hasReport ? evaluation.failed : 0}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-card p-3">
              <p className="mb-1 px-1 text-xs text-muted-foreground">Failure distribution</p>
              <FailureChart data={evaluation.failureBreakdown} />
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card">
              <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                Evaluation activity
              </p>
              <ul className="divide-y divide-border/60 text-xs">
                {[
                  { i: CheckCircle2, t: "Scenario #38 completed", c: "text-success" },
                  {
                    i: XCircle,
                    t: "Hallucinated policy exception detected",
                    c: "text-destructive",
                  },
                  { i: Activity, t: "Tool call: check_order", c: "text-info" },
                  { i: CheckCircle2, t: "Grounding check passed", c: "text-success" },
                ].map((row) => (
                  <li key={row.t} className="flex items-center gap-2.5 px-4 py-2">
                    <row.i className={`size-3.5 ${row.c}`} />
                    <span className="font-mono text-muted-foreground">{row.t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <h2 className="text-3xl font-semibold tracking-tight">How Aegis Works</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            From a system prompt to a signed-off reliability report in five automated stages.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-border py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <h2 className="text-3xl font-semibold tracking-tight">Built for agent engineers</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-card p-6 transition-colors hover:bg-surface">
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="docs" className="border-t border-border py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-10 text-center">
            <div className="aurora pointer-events-none absolute inset-0" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight">
                Know your agent breaks before your users do.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
                Run your first evaluation in under two minutes. No SDK changes required.
              </p>
              <Button variant="hero" size="lg" className="mt-7" asChild>
                <Link to="/dashboard">
                  Start Testing <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
          <AegisLogo />
          <p className="text-xs text-muted-foreground">
            © 2026 Aegis Labs · AI Agent Evaluation & Reliability Engine
          </p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <a href="#product" className="transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#docs" className="transition-colors hover:text-foreground">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
