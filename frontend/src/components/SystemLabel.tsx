export function SystemLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`tech-label ${className}`}>{children}</span>;
}
