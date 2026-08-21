import { ScrollReveal } from './ScrollReveal';
import { SystemLabel } from './SystemLabel';
import { Lightbulb, ShieldAlert } from 'lucide-react';

interface FailureAnalysisProps {
  why: string;
  recommendation: string;
}

export function FailureAnalysis({ why, recommendation }: FailureAnalysisProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ScrollReveal>
        <div className="border border-fault-500/20 bg-fault-500/5 p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-fault-400" />
            <SystemLabel className="text-fault-400">WHY IT FAILED</SystemLabel>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-bone-200">{why}</p>
        </div>
      </ScrollReveal>
      <ScrollReveal delay={0.15}>
        <div className="border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-violet-400" />
            <SystemLabel className="text-violet-400">RECOMMENDATION</SystemLabel>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-bone-200">{recommendation}</p>
        </div>
      </ScrollReveal>
    </div>
  );
}
