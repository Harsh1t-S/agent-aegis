import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FailureCategory, ReliabilityMetrics, Severity } from "@/lib/types";

const severityColor: Record<Severity, string> = {
  critical: "var(--destructive)",
  high: "var(--destructive)",
  medium: "var(--warning)",
  low: "var(--info)",
};

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
} as const;

export function FailureChart({
  data,
}: {
  data: { category: FailureCategory; count: number; severity: Severity }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="category"
          width={104}
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.35 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.category} fill={severityColor[d.severity]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MetricChart({ metrics }: { metrics: ReliabilityMetrics }) {
  const data = [
    { metric: "Task Success", value: metrics.taskSuccess },
    { metric: "Tool Accuracy", value: metrics.toolAccuracy },
    { metric: "Safety", value: metrics.safety },
    { metric: "Consistency", value: metrics.consistency },
    { metric: "Groundedness", value: metrics.groundedness },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Radar
          dataKey="value"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.28}
          strokeWidth={2}
        />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: { date: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis domain={[40, 100]} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MetricBars({ metrics }: { metrics: ReliabilityMetrics }) {
  const rows = [
    { label: "Task Success", value: metrics.taskSuccess },
    { label: "Tool Accuracy", value: metrics.toolAccuracy },
    { label: "Safety", value: metrics.safety },
    { label: "Consistency", value: metrics.consistency },
    { label: "Groundedness", value: metrics.groundedness },
  ];
  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono text-foreground">{r.value}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${r.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
