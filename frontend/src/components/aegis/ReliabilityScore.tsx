import { cn } from "@/lib/utils";
import { loadSettings } from "@/lib/workspace-settings";

interface Props {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

// The critical threshold is a workspace setting. It used to be hard-coded at 65
// here while the settings page offered a control for it, so changing that number
// did nothing anywhere in the app.
function criticalAt(): number {
  return loadSettings().criticalThreshold;
}

export function scoreTone(score: number): "success" | "warning" | "danger" {
  const critical = criticalAt();
  if (score >= Math.max(critical + 15, critical)) return "success";
  if (score >= critical) return "warning";
  return "danger";
}

export function scoreLabel(score: number): string {
  const critical = criticalAt();
  if (score >= critical + 25) return "Highly Reliable";
  if (score >= critical + 15) return "Reliable";
  if (score >= critical) return "Moderately Reliable";
  if (score >= critical - 15) return "Needs Attention";
  return "Critical Risk";
}

const strokeVar: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
};

export function ReliabilityScore({ score, size = 180, label, className }: Props) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(score, 0), 100) / 100);
  const tone = scoreTone(score);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeVar[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-4xl font-semibold tracking-tight">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
        {label && <span className="mt-1 text-xs font-medium text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
