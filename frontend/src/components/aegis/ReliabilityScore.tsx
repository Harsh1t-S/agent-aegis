import { cn } from "@/lib/utils";

interface Props {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

export function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 65) return "warning";
  return "danger";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Highly Reliable";
  if (score >= 80) return "Reliable";
  if (score >= 65) return "Moderately Reliable";
  if (score >= 50) return "Needs Attention";
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
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
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
