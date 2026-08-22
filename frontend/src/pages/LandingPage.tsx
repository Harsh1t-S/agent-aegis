import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AgentCore } from '@/components/AgentCore';
import { ScenarioStream } from '@/components/ScenarioStream';
import { ExecutionTrace } from '@/components/ExecutionTrace';
import { FailureReveal } from '@/components/FailureReveal';
import { ReliabilityScore } from '@/components/ReliabilityScore';
import { MetricLine } from '@/components/MetricLine';
import { VersionEvolution } from '@/components/VersionEvolution';
import { MassiveHeading } from '@/components/MassiveHeading';
import { ScrollReveal } from '@/components/ScrollReveal';
import { CountUp } from '@/components/CountUp';
import { SectionNumber } from '@/components/SectionNumber';
import { SystemLabel } from '@/components/SystemLabel';
import { exampleTrace } from '@/data/showcase';
import { useResource } from '@/hooks/useResource';
import { api } from '@/lib/api';

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const [destabilized, setDestabilized] = useState(false);

  const heroY = useTransform(scrollYProgress, [0, 0.08], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);
  const coreScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.7]);


  // Every number below this line comes from a real evaluation in the live
  // database. A landing page that invents its own product metrics is the exact
  // failure this product is built to catch, so when the API is unreachable the
  // sections say so rather than showing a flattering placeholder.
  const evaluations = useResource(() => api.evaluations(), []);
  const latest = evaluations.data?.[0];
  const agents = useResource(() => api.agents(), []);
  const showcaseAgent = latest
    ? agents.data?.find((a) => a.id === latest.agentId)
    : undefined;
  const detectedFailures = latest
    ? latest.failureBreakdown.reduce((sum, item) => sum + item.count, 0)
    : 0;
  // The counter animates up to the size of the suite that actually ran, not to
  // a round number chosen because it looks impressive.
  const suiteSize = latest?.total ?? 0;

  // Only the hero's own destabilisation is scroll-linked now, and it is purely
  // decorative — nothing a reader has to be able to read depends on it.
  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => setDestabilized(v > 0.12));
    return () => unsub();
  }, [scrollYProgress]);

  return (
    <div ref={containerRef} className="relative bg-ink-950">
      {/* HERO */}
      <motion.section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden noise"
        style={{ y: heroY, opacity: heroOpacity }}
      >
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/50 to-ink-950" />

        {/* Agent Core centerpiece */}
        {/* The centring offset is a motion value, not a Tailwind class.
            `-translate-x-1/2 -translate-y-1/2` and framer-motion both write the
            same `transform` property, and framer wins — so the class was silently
            dropped and the graphic hung from the centre point by its top-left
            corner instead of being centred on it. On a phone that put most of it
            off the right edge, where the section's overflow-hidden cropped it. */}
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ scale: coreScale, x: '-50%', y: '-50%' }}
        >
          {/* No centre node: the heading sits on top of this, and the node is an
              opaque disc with a label on it. */}
          <AgentCore destabilized={destabilized} size={500} core={false} />
        </motion.div>

        <div className="relative z-10 px-6 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="mb-8 flex flex-col items-center gap-1"
          >
            <SystemLabel>AI AGENT EVALUATION ENGINE</SystemLabel>
            <SystemLabel className="text-flux-400">STATUS: READY</SystemLabel>
            <SystemLabel className="text-bone-600">SYSTEM VERSION: 1.0</SystemLabel>
          </motion.div>

          <MassiveHeading
            lines={['CAN YOU', 'TRUST', 'YOUR AGENT?']}
            className="text-[clamp(3rem,11vw,9rem)] text-bone-50"
          />

          {/* mx-auto, not just text-center: the parent centres the *text* inside
              this block, but a max-width block with no auto margins still sits
              flush against the left edge of it. On a wide screen the paragraph
              was 448px hanging off the left of a 1400px column while the heading
              above it was centred. */}
          <motion.p
            className="mx-auto mt-8 max-w-md text-sm text-bone-300 md:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            Most agents look reliable—until the real world pushes back.
          </motion.p>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          <SystemLabel className="animate-pulse">SCROLL TO TEST ↓</SystemLabel>
        </motion.div>
      </motion.section>

      {/* SECTION 01 — THE QUESTION */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 grid-bg opacity-20" />

        <div className="relative z-10 text-center">
          <MassiveHeading
            lines={['EVERY AGENT', 'LOOKS RELIABLE.']}
            className="text-[clamp(2.5rem,9vw,7rem)] text-bone-50"
          />

          <motion.div
            className="my-16 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-signal-500 to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          />

          <MassiveHeading
            lines={['UNTIL YOU', 'PUSH IT.']}
            className="text-[clamp(2.5rem,9vw,7rem)] text-fault-500"
            delay={0.3}
          />

          <ScrollReveal delay={0.6} className="mt-12">
            <SystemLabel>
              REAL-WORLD FAILURE MODES ARE NOT FOUND BY ASKING EASY QUESTIONS.
            </SystemLabel>
          </ScrollReveal>
        </div>

        {/* Destabilized visual */}
        {/* Same conflict: animating `x` replaced the class's vertical centring, so
            this sat with its top edge on the midline rather than straddling it. */}
        <motion.div
          className="absolute right-0 top-1/2 opacity-20"
          style={{ y: '-50%' }}
          initial={{ x: 200 }}
          whileInView={{ x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <AgentCore destabilized size={300} />
        </motion.div>
      </section>

      {/* SECTION 02 — INPUT */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:px-6">
        <SectionNumber label="01 / INPUT" className="mb-8" />
        <MassiveHeading
          lines={['WHO ARE', 'WE TESTING?']}
          className="mb-16 text-center text-[clamp(2.5rem,8vw,6rem)] text-bone-50"
        />

        <ScrollReveal className="w-full max-w-2xl">
          <div className="border border-bone-600/20 bg-ink-900/60 p-8 backdrop-blur-sm">
            <div className="space-y-6">
              {[
                { label: 'AGENT', value: 'Customer Support Agent' },
                { label: 'DOMAIN', value: 'Customer Service' },
                { label: 'TOOLS', value: 'check_order()\nprocess_refund()\nsearch_policy()' },
                { label: 'STATUS', value: 'READY FOR EVALUATION' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  className="flex flex-col gap-2 border-b border-bone-600/20 pb-4 last:border-0 md:flex-row md:items-start md:gap-8"
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2, duration: 0.6 }}
                >
                  <span className="tech-label w-32 shrink-0">{item.label}</span>
                  <span
                    className={`font-mono text-sm whitespace-pre-line ${
                      item.label === 'STATUS' ? 'text-flux-400' : 'text-bone-100'
                    }`}
                  >
                    {item.value}
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              <Link
                to="/app/agents/new"
                className="mt-8 block w-full border border-signal-500/40 bg-signal-500/10 py-4 text-center font-mono text-xs uppercase tracking-[0.2em] text-signal-400 transition-colors hover:bg-signal-500/20"
              >
                INITIALIZE EVALUATION →
              </Link>
            </motion.div>
          </div>
        </ScrollReveal>
      </section>

      {/* SECTION 03 — STRESS TEST */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-20 sm:px-6">
        <div className="absolute inset-0">
          <ScenarioStream intensity={suiteSize > 0 ? Math.min(suiteSize / 6, 2) : 1} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-transparent to-ink-950" />

        <div className="relative z-10 text-center">
          <SectionNumber label="02 / STRESS TEST" className="mb-8 justify-center" />
          <MassiveHeading
            lines={['BREAK IT', 'BEFORE', 'USERS DO.']}
            className="text-[clamp(2.5rem,9vw,7rem)] text-bone-50"
          />

          <motion.div className="mt-16" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <SystemLabel>SCENARIOS IN THE LATEST SUITE</SystemLabel>
            <CountUp
              value={suiteSize}
              pad={2}
              className="massive mt-2 block text-6xl text-signal-400"
            />
            <SystemLabel className="mt-3 block text-bone-600">
              {latest
                ? `GENERATED FOR ${latest.agentName.toUpperCase()} ${latest.version.toUpperCase()}`
                : 'LIVE COUNT UNAVAILABLE'}
            </SystemLabel>
          </motion.div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {['Realistic', 'Edge', 'Ambiguous', 'Adversarial'].map((cat, i) => (
              <ScrollReveal key={cat} delay={i * 0.05}>
                <span className="border border-bone-600/30 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-bone-400">
                  {cat}
                </span>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 04 — EXECUTION */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:px-6">
        <SectionNumber label="03 / EXECUTE" className="mb-8" />
        <MassiveHeading
          lines={['WATCH', 'EVERY', 'DECISION.']}
          className="mb-16 text-center text-[clamp(2.5rem,8vw,6rem)] text-bone-50"
        />

        <ScrollReveal className="w-full max-w-md">
          <div className="border border-bone-600/20 bg-ink-900/60 p-8">
            <ExecutionTrace events={exampleTrace} />
          </div>
          <p className="mt-4 text-center">
            <SystemLabel className="text-bone-600">
              ILLUSTRATIVE EXAMPLE — CLICK AN EVENT FOR DETAIL
            </SystemLabel>
          </p>
        </ScrollReveal>
      </section>

      {/* SECTION 05 — FAILURE */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:px-6">
        <SectionNumber label="04 / DETECT" className="mb-8" />

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <CountUp
            value={latest ? detectedFailures : 0}
            className="massive block text-[clamp(6rem,20vw,16rem)] text-fault-500"
          />
          <MassiveHeading lines={['FAILURES.']} className="text-3xl text-fault-400" delay={0.3} />
          <SystemLabel className="mt-4 block text-bone-600">
            {latest
              ? `DETECTED IN ${latest.agentName.toUpperCase()} ${latest.version.toUpperCase()} — LIVE`
              : 'LIVE RESULTS UNAVAILABLE'}
          </SystemLabel>
        </motion.div>

        <div className="mt-16 w-full max-w-3xl">
          {latest ? (
            <FailureReveal
              items={latest.failureBreakdown}
              tests={latest.tests}
              evaluationId={latest.id}
            />
          ) : (
            <p className="text-center text-sm text-bone-500">
              The evaluation API is not reachable right now, so no numbers are shown here.
            </p>
          )}
        </div>
      </section>

      {/* SECTION 06 — THE SCORE */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:px-6">
        <SectionNumber label="05 / ANALYZE" className="mb-8" />

        <div className="text-center">
          <MassiveHeading
            lines={["RELIABILITY", "ISN'T A", "FEELING."]}
            className="text-[clamp(2.5rem,8vw,6rem)] text-bone-50"
          />
          <MassiveHeading
            lines={["IT'S", "MEASURABLE."]}
            className="mt-8 text-[clamp(2.5rem,8vw,6rem)] text-signal-400"
            delay={0.4}
          />
        </div>

        <motion.div
          className="my-16"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <ReliabilityScore score={latest?.score ?? 0} size="xl" />
        </motion.div>

        {latest ? (
          <>
            <div className="grid w-full max-w-2xl gap-6">
              {[
                { label: 'TASK SUCCESS', value: latest.metrics.taskSuccess, color: '#26a9d0' },
                { label: 'TOOL ACCURACY', value: latest.metrics.toolAccuracy, color: '#1cb8d8' },
                { label: 'SAFETY', value: latest.metrics.safety, color: '#22c57e' },
                { label: 'CONSISTENCY', value: latest.metrics.consistency, color: '#5bc8e8' },
                { label: 'GROUNDEDNESS', value: latest.metrics.groundedness, color: '#eda31c' },
              ].map((m, i) => (
                <ScrollReveal key={m.label} delay={i * 0.1}>
                  <MetricLine {...m} delay={i * 0.1} />
                </ScrollReveal>
              ))}
            </div>
            <SystemLabel className="mt-10 block text-center text-bone-600">
              {latest.agentName.toUpperCase()} {latest.version.toUpperCase()} —{' '}
              {latest.total} SCENARIOS — LIVE FROM THE EVALUATION API
            </SystemLabel>
          </>
        ) : (
          <p className="mx-auto max-w-md text-center text-sm text-bone-500">
            These dimensions are read live from the evaluation API, which is not reachable
            right now. Nothing is shown in its place.
          </p>
        )}
      </section>

      {/* SECTION 07 — EVOLUTION */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:px-6">
        <SectionNumber label="06 / EVOLVE" className="mb-8" />
        <MassiveHeading
          lines={["DON'T JUST", 'BUILD AGENTS.']}
          className="mb-6 text-center text-[clamp(2.5rem,8vw,6rem)] text-bone-50"
        />
        <MassiveHeading
          lines={['MAKE THEM', 'BETTER.']}
          className="mb-16 text-center text-[clamp(2.5rem,8vw,6rem)] text-signal-400"
          delay={0.3}
        />

        <div className="w-full max-w-4xl">
          {showcaseAgent && showcaseAgent.versions.length > 0 ? (
            <>
              <VersionEvolution versions={showcaseAgent.versions} />
              <SystemLabel className="mt-8 block text-center text-bone-600">
                {showcaseAgent.name.toUpperCase()} — EVERY EVALUATED VERSION — LIVE
              </SystemLabel>
            </>
          ) : (
            <p className="text-center text-sm text-bone-500">
              Version history is read live from the evaluation API. Nothing is shown until it
              responds.
            </p>
          )}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        {/* Decorative only. Without pointer-events-none these absolutely
            positioned layers paint above the static content below them and
            swallow every click on the two calls to action. */}
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-signal-500/10 via-transparent to-transparent" />

        <MassiveHeading
          lines={["DON'T DEPLOY", 'HOPE.']}
          className="text-[clamp(2.5rem,10vw,8rem)] text-bone-50"
        />
        <div className="my-12 h-px w-32 bg-gradient-to-r from-transparent via-signal-500 to-transparent" />
        <MassiveHeading
          lines={['DEPLOY', 'CONFIDENCE.']}
          className="text-[clamp(2.5rem,10vw,8rem)] text-signal-400"
          delay={0.3}
        />

        <motion.div
          className="relative z-10 mt-16 flex flex-col items-center gap-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <Link
            to="/app"
            className="group border border-signal-500/40 bg-signal-500/10 px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] text-signal-400 transition-all hover:bg-signal-500/20 hover:shadow-[0_0_30px_rgba(91,200,232,0.3)] sm:px-12 sm:text-sm"
          >
            LAUNCH AEGIS →
          </Link>
          <Link
            to="/how-it-works"
            className="flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.2em] text-bone-400 transition-colors hover:text-bone-100"
          >
            EXPLORE THE SYSTEM
          </Link>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-bone-600/20 px-4 py-12 sm:px-6 md:px-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4">
            <SystemLabel>AEGIS / AGENT RELIABILITY SYSTEM / V1.0</SystemLabel>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6">
            <Link
              to="/how-it-works"
              className="flex min-h-11 items-center px-1 font-mono text-[10px] uppercase tracking-wider text-bone-500 hover:text-bone-200"
            >
              SYSTEM
            </Link>
            <Link
              to="/about"
              className="flex min-h-11 items-center px-1 font-mono text-[10px] uppercase tracking-wider text-bone-500 hover:text-bone-200"
            >
              PRODUCT
            </Link>
            <Link
              to="/app"
              className="flex min-h-11 items-center px-1 font-mono text-[10px] uppercase tracking-wider text-bone-500 hover:text-bone-200"
            >
              LAUNCH
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
