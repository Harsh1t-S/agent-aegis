import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AegisLogo } from '@/components/AegisLogo';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'signin' | 'signup' | 'magic';

export default function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/app';

  useEffect(() => {
    if (!auth.loading && auth.user) navigate(next, { replace: true });
  }, [auth.loading, auth.user, navigate, next]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await auth.signIn(email.trim(), password);
        navigate(next, { replace: true });
      } else if (mode === 'signup') {
        const result = await auth.signUp(email.trim(), password);
        setMessage(result.confirmationRequired
          ? 'Check your inbox to confirm your account.'
          : 'Account created. Opening your workspace…');
      } else {
        await auth.sendMagicLink(email.trim());
        setMessage('A secure sign-in link is on its way.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-ink-950 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-bone-600/20 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative"><AegisLogo /></div>
        <div className="relative max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-signal-400">
            PRIVATE WORKSPACES
          </p>
          <h1 className="massive mt-5 text-6xl text-bone-50">
            BREAK YOUR AGENT.<br /><span className="text-signal-400">BEFORE USERS DO.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-bone-300">
            Test consequential support workflows against explicit policies, inspect every
            tool call, and keep failures as release-blocking regression tests.
          </p>
        </div>
        <div className="relative flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-bone-500">
          <ShieldCheck className="h-4 w-4 text-flux-400" />
          Prompts, traces, and reports stay inside your workspace
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><AegisLogo /></div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal-400">
            {mode === 'signup' ? 'CREATE WORKSPACE' : 'WELCOME BACK'}
          </p>
          <h2 className="massive mt-3 text-4xl text-bone-50">
            {mode === 'signup' ? 'START TESTING.' : mode === 'magic' ? 'EMAIL LINK.' : 'SIGN IN.'}
          </h2>

          {!auth.configured && (
            <p className="mt-6 border border-fault-500/40 bg-fault-500/5 p-4 text-sm text-fault-300">
              {auth.error}
            </p>
          )}

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider text-bone-400">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full border border-bone-600/35 bg-ink-900 px-4 py-3 text-bone-50 outline-none focus:border-signal-400"
              />
            </div>
            {mode !== 'magic' && (
              <div>
                <label htmlFor="password" className="font-mono text-[11px] uppercase tracking-wider text-bone-400">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full border border-bone-600/35 bg-ink-900 px-4 py-3 text-bone-50 outline-none focus:border-signal-400"
                />
              </div>
            )}
            {error && <p role="alert" className="text-sm text-fault-400">{error}</p>}
            {message && <p role="status" className="text-sm text-flux-400">{message}</p>}
            <button
              type="submit"
              disabled={busy || !auth.configured}
              className="flex min-h-12 w-full items-center justify-center gap-2 border border-signal-500/50 bg-signal-500/15 font-mono text-xs uppercase tracking-[0.18em] text-signal-300 enabled:hover:bg-signal-500/25 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'magic' ? 'SEND SECURE LINK' : 'OPEN WORKSPACE'}
            </button>
          </form>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
              className="min-h-11 border border-bone-600/30 font-mono text-[10px] uppercase tracking-wider text-bone-300 hover:text-bone-50">
              {mode === 'signup' ? 'I HAVE AN ACCOUNT' : 'CREATE ACCOUNT'}
            </button>
            <button type="button" onClick={() => setMode(mode === 'magic' ? 'signin' : 'magic')}
              className="min-h-11 border border-bone-600/30 font-mono text-[10px] uppercase tracking-wider text-bone-300 hover:text-bone-50">
              {mode === 'magic' ? 'USE PASSWORD' : 'USE EMAIL LINK'}
            </button>
          </div>
          <button type="button" onClick={() => void auth.signInWithGoogle()} disabled={!auth.configured}
            className="mt-3 min-h-11 w-full border border-bone-600/30 font-mono text-[10px] uppercase tracking-wider text-bone-300 hover:text-bone-50 disabled:opacity-50">
            CONTINUE WITH GOOGLE
          </button>
          <p className="mt-8 text-center text-xs text-bone-500">
            Want to look around first? <Link to="/demo" className="text-signal-400 hover:underline">Explore the public demo</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
