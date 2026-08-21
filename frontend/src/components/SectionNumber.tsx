export function SectionNumber({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="tech-label text-signal-500">{label}</span>
      <span className="h-px w-12 bg-gradient-to-r from-signal-500/60 to-transparent" />
    </div>
  );
}
