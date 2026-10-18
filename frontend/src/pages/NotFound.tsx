import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Backdrop } from '@/components/Backdrop';
import { Accent } from '@/components/SiteSection';
import { ctaPrimary, ctaSecondary } from '@/lib/ui';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-5 text-center">
      <Backdrop />
      <p className="inline-flex items-center gap-2.5 border border-fault-500/45 bg-fault-500/10 px-3 py-1.5 text-sm text-fault-300">
        <span aria-hidden className="h-2 w-2 rounded-full bg-fault-400" />
        404 · No page at this address
      </p>
      <h1 className="mt-7 font-display text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[0.98] tracking-ultraTight text-bone-50">
        Nothing <Accent>here.</Accent>
      </h1>
      <p className="mt-6 max-w-md break-all font-mono text-sm text-bone-400">{pathname}</p>
      <div className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Link to="/" className={ctaPrimary}>
          Go to the home page <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
        <Link to="/app" className={ctaSecondary}>Open the console</Link>
      </div>
    </main>
  );
}
