import { Link, useLocation } from 'react-router-dom';
import { AegisLogo } from './AegisLogo';
import { LayoutGrid, Bot, GitCompareArrows, ArrowLeft } from 'lucide-react';

const navItems = [
  { to: '/app', label: 'CONTROL', icon: LayoutGrid },
  { to: '/app/agents', label: 'AGENTS', icon: Bot },
  { to: '/app/compare', label: 'COMPARE', icon: GitCompareArrows },
];

export function AppNavigation() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-bone-600/20 bg-ink-950/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-8">
          <AegisLogo />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-bone-500 md:inline">
            / CONTROL CENTER
          </span>
        </div>

        <nav className="flex shrink-0 items-center">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 min-w-11 items-center justify-center gap-2 px-2 font-mono text-[11px] uppercase tracking-wider transition-colors sm:px-4 ${
                  active ? 'text-violet-400' : 'text-bone-400 hover:text-bone-100'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
          <Link
            to="/"
            aria-label="Exit to the marketing site"
            className="ml-1 flex min-h-11 min-w-11 items-center justify-center gap-2 border-l border-bone-600/20 pl-3 font-mono text-[11px] uppercase tracking-wider text-bone-400 transition-colors hover:text-bone-100 sm:ml-2 sm:pl-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">EXIT</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
