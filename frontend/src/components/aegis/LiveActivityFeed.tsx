import { cn } from "@/lib/utils";

export interface ActivityEvent {
  id: number;
  message: string;
  time: string;
  tone: "info" | "success" | "warning" | "danger" | "primary";
}

const dotTone: Record<ActivityEvent["tone"], string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  primary: "bg-primary",
};

export function LiveActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="max-h-[420px] overflow-y-auto">
      <ul className="divide-y divide-border/60">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dotTone[e.tone])} />
            <p className="min-w-0 flex-1 font-mono text-xs break-words text-muted-foreground">
              {e.message}
            </p>
            <span className="font-mono text-[11px] text-muted-foreground/70">{e.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
