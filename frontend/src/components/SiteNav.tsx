import { Link, useLocation } from 'react-router-dom';
import { AegisLogo } from './AegisLogo';
import { motion } from 'framer-motion';

const links = [
  { to: '/how-it-works', label: 'SYSTEM' },
  { to: '/about', label: 'PRODUCT' },
];

export function SiteNav() {
  const { pathname } = useLocation();

  return (
    <motion.header
      className="fixed left-0 right-0 top-0 z-50"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex h-16 items-center justify-between px-6 md:px-10">
        <AegisLogo />

        <nav className="flex items-center gap-6 md:gap-10">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={pathname === link.to ? 'page' : undefined}
              className={`font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                pathname === link.to
                  ? 'text-bone-50'
                  : 'text-bone-400 hover:text-bone-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/app"
            className="group flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-violet-400 transition-colors hover:text-violet-300"
          >
            LAUNCH AEGIS
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
