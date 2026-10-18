import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bot,
  CreditCard,
  GitCompareArrows,
  KeyRound,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AegisLogo } from './AegisLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  /** One line under the group name saying how its items relate. */
  caption?: string;
  items: NavItem[];
}

/**
 * Grouped in the order the work happens: register an agent, run it, read the
 * runs, compare versions. Workspace administration sits apart from that flow
 * instead of hiding in a dropdown beside it.
 */
const groups: NavGroup[] = [
  {
    label: 'Testing',
    caption: 'Add an agent, run it, read the report, compare versions.',
    items: [
      { to: '/app', label: 'Overview', icon: LayoutGrid },
      { to: '/app/agents', label: 'Agents', icon: Bot },
      { to: '/app/evaluations', label: 'Runs', icon: ListChecks },
      { to: '/app/compare', label: 'Compare versions', icon: GitCompareArrows },
    ],
  },
  {
    label: 'Workspace',
    caption: 'Settings and access for everyone here.',
    items: [
      { to: '/app/settings', label: 'Run settings', icon: SlidersHorizontal },
      { to: '/app/team', label: 'Team', icon: Users },
      { to: '/app/billing', label: 'Billing', icon: CreditCard },
      { to: '/app/developer', label: 'API & audit', icon: KeyRound, adminOnly: true },
    ],
  },
];

/** `/app` must match only itself, or Overview lights up on every console screen. */
function isActive(pathname: string, to: string): boolean {
  if (to === '/app') return pathname === '/app';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function currentLabel(pathname: string): string {
  if (isActive(pathname, '/app/profile')) return 'Profile';
  const all = groups.flatMap((group) => group.items);
  // Longest match first so /app/agents/new reads as Agents, not Overview.
  const match = [...all].sort((a, b) => b.to.length - a.to.length).find((item) => isActive(pathname, item.to));
  return match?.label ?? '';
}

function initials(name: string) {
  const letters = name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]);
  return (letters.join('') || '?').toUpperCase();
}

function SidebarContent() {
  const location = useLocation();
  const auth = useAuth();
  const workspace = useWorkspace();
  const role = workspace.current?.role;
  const canAdminister = role === 'owner' || role === 'admin';
  const email = workspace.bootstrap?.user.email || auth.user?.email || '';
  const name = workspace.bootstrap?.user.displayName || email.split('@')[0] || 'Account';
  const profileActive = isActive(location.pathname, '/app/profile');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-bone-600/20 px-5">
        <AegisLogo />
      </div>

      <div className="border-b border-bone-600/20 px-4 py-4">
        <label htmlFor="workspace-switcher" className="tech-label">Workspace</label>
        <select
          id="workspace-switcher"
          value={workspace.current?.id ?? ''}
          onChange={(event) => {
            workspace.select(event.target.value);
            window.location.assign('/app');
          }}
          className="mt-2 min-h-11 w-full border border-bone-600/40 bg-ink-950 px-3 text-sm text-bone-100"
        >
          {workspace.workspaces.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>

      <nav aria-label="Console" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="tech-label px-3">{group.label}</p>
            {group.caption && <p className="mt-1 px-3 text-sm leading-snug text-bone-400">{group.caption}</p>}
            <ul className="mt-2 space-y-0.5">
              {group.items.filter((item) => !item.adminOnly || canAdminister).map((item) => {
                const active = isActive(location.pathname, item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 border-l-2 px-3 text-sm transition-colors focus-visible:-outline-offset-2 ${
                        active
                          ? 'border-signal-400 bg-signal-500/15 font-medium text-signal-300'
                          : 'border-transparent text-bone-200 hover:bg-ink-850 hover:text-bone-50'
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-bone-600/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          to="/app/profile"
          aria-current={profileActive ? 'page' : undefined}
          className={`flex items-center gap-3 px-2 py-2 transition-colors ${
            profileActive ? 'bg-signal-500/15' : 'hover:bg-ink-850'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-signal-500/15 font-mono text-xs font-bold text-signal-300">
            {initials(name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-bone-100">{name}</span>
            <span className="block truncate text-sm text-bone-400">
              {role ? `${role[0].toUpperCase()}${role.slice(1)} · ` : ''}View profile
            </span>
          </span>
        </Link>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            to="/"
            className="flex min-h-11 items-center justify-center gap-1.5 border border-bone-600/35 text-sm text-bone-300 transition-colors hover:border-bone-400/60 hover:text-bone-50"
          >
            Website <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="flex min-h-11 items-center justify-center gap-1.5 border border-bone-600/35 text-sm text-bone-300 transition-colors hover:border-fault-500/60 hover:text-fault-300"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The console frame: one sidebar on desktop, the same sidebar in a drawer on a
 * phone, and a single content column every screen shares. It renders outside the
 * page transition, so navigating no longer fades the navigation out and back in.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

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
    <div className="min-h-screen bg-ink-950">
      <a
        href="#app-main"
        className="sr-only z-[60] bg-signal-500 px-4 py-2 text-sm text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-bone-600/20 bg-ink-900 lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-bone-600/20 bg-ink-950/90 px-4 backdrop-blur-xl lg:hidden">
        <AegisLogo />
        <span className="min-w-0 flex-1 truncate px-3 text-sm text-bone-300">{currentLabel(location.pathname)}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-bone-200 hover:text-bone-50"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

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
              className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-bone-600/25 bg-ink-900 lg:hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="absolute right-2 top-2.5 flex h-11 w-11 items-center justify-center text-bone-300 hover:text-bone-50"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* The landing page's horizon glow, faint, behind the top of every screen. A
          background rather than a layer, so nothing inside gains a stacking context. */}
      <div className="bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(38,169,208,0.09),transparent_70%)] bg-[length:100%_26rem] bg-no-repeat bg-origin-content lg:pl-64">
        <main id="app-main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
