import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export function AegisLogo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex min-h-11 items-center gap-2 ${className}`}>
      <Shield className="h-5 w-5 text-violet-500 transition-transform group-hover:scale-110" strokeWidth={2} />
      <span className="font-display text-lg font-bold tracking-tight text-bone-50">AEGIS</span>
    </Link>
  );
}
