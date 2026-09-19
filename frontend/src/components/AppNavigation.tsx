import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AegisLogo } from './AegisLogo';
import {
  ArrowLeft,
  Bot,
  CreditCard,
  ChevronDown,
  GitCompareArrows,
  KeyRound,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const navItems = [
  { to: '/app', label: 'CONTROL', icon: LayoutGrid },
  { to: '/app/agents', label: 'AGENTS', icon: Bot },
  { to: '/app/evaluations', label: 'RUNS', icon: ListChecks },
  { to: '/app/compare', label: 'COMPARE', icon: GitCompareArrows },
  { to: '/app/settings', label: 'SETTINGS', icon: Settings2 },
];

const workspaceItems = [
  { to: '/app/team', label: 'TEAM', icon: Users },
  { to: '/app/billing', label: 'BILLING', icon: CreditCard },
  { to: '/app/developer', label: 'API & AUDIT', icon: KeyRound },
];

/**
 * `/app` must match only itself — every other route starts with it, so a prefix
 * match lit Control up on every screen in the console.
 */
function isActive(pathname: string, to: string): boolean {
  if (to === '/app') return pathname === '/app';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppNavigation() {
  const location = useLocation();
  const auth = useAuth();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const canAdminister = workspace.current?.role === 'owner' || workspace.current?.role === 'admin';
  const visibleWorkspaceItems = workspaceItems.filter(
    (item) => item.to !== '/app/developer' || canAdminister,
  );

  // Close on navigation, or the drawer stays over the page it just opened.
  useEffect(() => setOpen(false), [location.pathname]);

  // A drawer that scrolls the page behind it reads as broken on a phone.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-bone-600/20 bg-ink-950/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <AegisLogo />
          <label className="sr-only" htmlFor="workspace-switcher">Workspace</label>
          <select
            id="workspace-switcher"
            value={workspace.current?.id ?? ''}
            onChange={(event) => {
              workspace.select(event.target.value);
              window.location.assign('/app');
            }}
            className="min-w-0 max-w-44 border border-bone-600/25 bg-ink-900 px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-bone-300 outline-none focus:border-signal-400 sm:max-w-56"
          >
            {workspace.workspaces.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        {/* Five destinations do not fit as icons on a 375px screen; below lg they
            live in a drawer instead of being squeezed to unlabelled glyphs. */}
        <nav className="hidden shrink-0 items-center lg:flex">
          {navItems.map((item) => {
            const active = isActive(location.pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  active ? 'text-signal-400' : 'text-bone-400 hover:text-bone-100'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <details key={location.pathname} className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-wider text-bone-400 hover:text-bone-100">
              WORKSPACE <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 top-full z-50 min-w-48 border border-bone-600/25 bg-ink-900 p-1 shadow-2xl">
              {visibleWorkspaceItems.map((item) => (
                <Link key={item.to} to={item.to}
                  className="flex min-h-11 items-center gap-3 px-3 font-mono text-[10px] uppercase tracking-wider text-bone-300 hover:bg-ink-850 hover:text-signal-300">
                  <item.icon className="h-3.5 w-3.5" /> {item.label}
                </Link>
              ))}
            </div>
          </details>
          <Link
            to="/"
            className="ml-2 flex min-h-11 items-center gap-2 border-l border-bone-600/20 pl-4 font-mono text-[11px] uppercase tracking-wider text-bone-400 transition-colors hover:text-bone-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>EXIT</span>
          </Link>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            title={auth.user?.email ?? 'Sign out'}
            className="ml-3 flex h-11 w-11 items-center justify-center text-bone-500 hover:text-bone-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </button>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-bone-300 transition-colors hover:text-bone-50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-0 right-0 z-50 flex w-[78vw] max-w-xs flex-col border-l border-bone-600/25 bg-ink-900 lg:hidden"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-bone-600/20 px-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-bone-500">
                  CONTROL CENTER
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="-mr-2 flex h-11 w-11 items-center justify-center text-bone-300 hover:text-bone-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-1 flex-col overflow-y-auto py-2">
                {navItems.map((item) => {
                  const active = isActive(location.pathname, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-14 items-center gap-3 border-l-2 px-5 font-mono text-xs uppercase tracking-wider transition-colors ${
                        active
                          ? 'border-signal-500 bg-signal-500/10 text-signal-300'
                          : 'border-transparent text-bone-300 hover:bg-ink-850 hover:text-bone-50'
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
                <div className="mx-5 my-2 border-t border-bone-600/20" />
                {visibleWorkspaceItems.map((item) => {
                  const active = isActive(location.pathname, item.to);
                  return (
                    <Link key={item.to} to={item.to}
                      className={`flex min-h-14 items-center gap-3 border-l-2 px-5 font-mono text-xs uppercase tracking-wider ${active ? 'border-signal-500 bg-signal-500/10 text-signal-300' : 'border-transparent text-bone-300 hover:bg-ink-850'}`}>
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-bone-600/20 pb-[env(safe-area-inset-bottom)]">
                <button type="button" onClick={() => void auth.signOut()}
                  className="flex min-h-14 w-full items-center gap-3 px-5 font-mono text-xs uppercase tracking-wider text-bone-400 hover:text-bone-100">
                  <LogOut className="h-4 w-4" /> SIGN OUT
                </button>
                <Link to="/" className="flex min-h-14 items-center gap-3 px-5 font-mono text-xs uppercase tracking-wider text-bone-400 hover:text-bone-100">
                  <ArrowLeft className="h-4 w-4 shrink-0" /> EXIT TO SITE
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
