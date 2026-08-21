import { Link, useLocation } from 'react-router-dom';
import { MassiveHeading } from '@/components/MassiveHeading';
import { SystemLabel } from '@/components/SystemLabel';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 text-center">
      <SystemLabel className="text-fault-400">404 / NO SUCH ROUTE</SystemLabel>
      <MassiveHeading
        lines={['NOTHING', 'HERE.']}
        className="mt-6 text-[clamp(2.5rem,10vw,7rem)] text-bone-50"
      />
      <p className="mt-8 max-w-md font-mono text-xs text-bone-500">{pathname}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          to="/app"
          className="border border-signal-500/40 bg-signal-500/10 px-6 py-3 font-mono text-xs uppercase tracking-wider text-signal-400 hover:bg-signal-500/20"
        >
          CONTROL CENTER
        </Link>
        <Link
          to="/"
          className="border border-bone-600/30 px-6 py-3 font-mono text-xs uppercase tracking-wider text-bone-300 hover:border-bone-400 hover:text-bone-50"
        >
          HOME
        </Link>
      </div>
    </div>
  );
}
