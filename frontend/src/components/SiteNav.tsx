import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { AegisLogo } from './AegisLogo';
import { useAuth } from '@/contexts/AuthContext';

const links = [
  { to: '/demo', label: 'Demo' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
];

const navPrimary =
  'group inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border border-signal-400 bg-signal-500 px-4 text-sm font-semibold text-ink-950 shadow-[0_0_28px_-8px_rgba(38,169,208,0.8)] transition-colors hover:bg-signal-400';

/**
 * Transparent over a page's opening, then a blurred bar once the page scrolls.
 * On a phone it keeps only the account actions; the page links move to the footer.
 */
export function SiteNav() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <motion.header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? 'border-bone-600/20 bg-ink-950/80 backdrop-blur-md' : 'border-transparent'
      }`}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <AegisLogo />
        <nav aria-label="Main" className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  aria-current={pathname === link.to ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center px-3 text-sm font-medium transition-colors ${
                    pathname === link.to ? 'text-bone-50' : 'text-bone-300 hover:text-bone-50'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <span aria-hidden className="mx-2 hidden h-5 w-px bg-bone-600/40 md:block" />
          {auth.user ? (
            <Link to="/app" className={navPrimary}>
              Open console
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-bone-200 transition-colors hover:text-bone-50"
              >
                Sign in
              </Link>
              <Link to="/auth?mode=signup&next=/app/agents/new" className={navPrimary}>
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}

const footerColumns = [
  { title: 'Product', links: [{ to: '/demo', label: 'Demo' }, { to: '/how-it-works', label: 'How it works' }, { to: '/pricing', label: 'Pricing' }] },
  { title: 'Company', links: [{ to: '/about', label: 'About Aegis' }] },
  { title: 'Account', links: [{ to: '/auth', label: 'Sign in' }, { to: '/auth?mode=signup', label: 'Create account' }, { to: '/auth?mode=forgot', label: 'Reset password' }] },
];

/** The end of every public page: every page link, which the phone nav leaves out. */
export function SiteFooter() {
  return (
    <footer className="border-t border-bone-600/20 bg-ink-950 px-5 pb-10 pt-14 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.1fr_2fr]">
        <div>
          <AegisLogo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-bone-300">
            Release testing for AI agents. Find the unsafe action before your users do.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold text-bone-50">{column.title}</p>
              <ul className="mt-3 space-y-1">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="inline-flex min-h-9 items-center text-sm text-bone-300 transition-colors hover:text-bone-50">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <p className="mx-auto mt-12 flex max-w-7xl items-center gap-2 border-t border-bone-600/20 pt-6 text-sm text-bone-400">
        <ShieldCheck className="h-4 w-4 shrink-0 text-flux-400" aria-hidden />
        Prompts, traces and reports stay inside your workspace.
      </p>
    </footer>
  );
}
