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
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <AegisLogo />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-bone-500 md:inline">
            / CONTROL CENTER
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
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
            className="ml-2 flex items-center gap-2 border-l border-bone-600/20 pl-4 font-mono text-[11px] uppercase tracking-wider text-bone-400 transition-colors hover:text-bone-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">EXIT</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
