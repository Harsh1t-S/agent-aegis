import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail, TriangleAlert } from 'lucide-react';
import { AuthFrame, PasswordField } from '@/components/AuthFrame';
import { useAuth } from '@/contexts/AuthContext';
import { buttonPrimary, buttonSecondary, fieldInput, fieldLabel, noticeError, noticeSuccess } from '@/lib/ui';

type Mode = 'signin' | 'signup' | 'magic' | 'forgot';

const COPY: Record<Mode, { title: string; lead: string; submit: string }> = {
  signin: {
    title: 'Sign in to Aegis',
    lead: 'Open your workspace to run, read and compare agent releases.',
    submit: 'Sign in',
  },
  signup: {
    title: 'Create your account',
    lead: 'Start with 60 free scenario credits. No card needed.',
    submit: 'Create account',
  },
  magic: {
    title: 'Sign in with an email link',
    lead: 'We’ll email you a one-time link, so you don’t need your password.',
    submit: 'Send sign-in link',
  },
  forgot: {
    title: 'Reset your password',
    lead: 'Enter the email you sign in with and we’ll send a link to choose a new password.',
    submit: 'Send reset link',
  },
};

function isMode(value: string | null): value is Mode {
  return value !== null && value in COPY;
}

function failureMessage(cause: unknown) {
  // Supabase's built-in mailer only reaches addresses it has been told about.
  if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'email_address_not_authorized') {
    return 'Aegis can’t send email to this address yet. Ask your Aegis admin for help.';
  }
  return cause instanceof Error ? cause.message : 'Authentication failed.';
}

export default function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('mode');
  const [mode, setMode] = useState<Mode>(isMode(requested) ? requested : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/app';
  const copy = COPY[mode];
  const usesPassword = mode === 'signin' || mode === 'signup';

  useEffect(() => {
    if (!auth.loading && auth.user) navigate(next, { replace: true });
  }, [auth.loading, auth.user, navigate, next]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'signin') {
        await auth.signIn(address, password);
        navigate(next, { replace: true });
      } else if (mode === 'signup') {
        const result = await auth.signUp(address, password);
        setMessage(result.confirmationRequired
          ? `Check your inbox. We sent a confirmation link to ${address}.`
          : 'Account created. Opening your workspace…');
      } else if (mode === 'magic') {
        await auth.sendMagicLink(address);
        setMessage(`Check your inbox. A sign-in link is on its way to ${address}.`);
      } else {
        await auth.requestPasswordReset(address);
        setMessage(`If an account uses ${address}, a reset link is on its way. Check your inbox and spam folder.`);
      }
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      footer={(
        <>
          Want to look around first?{' '}
          <Link to="/demo" className="text-signal-300 hover:text-signal-200 hover:underline">Explore the public demo</Link>
        </>
      )}
    >
      {usesPassword ? (
        <div role="group" aria-label="Account" className="grid grid-cols-2 gap-1 border border-bone-600/35 bg-ink-950 p-1">
          {(['signin', 'signup'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => switchMode(option)}
              className={`min-h-11 text-sm font-medium transition-colors ${
                mode === option
                  ? 'bg-ink-800 text-bone-50 shadow-[inset_0_-2px_0_0_#5bc8e8]'
                  : 'text-bone-300 hover:text-bone-50'
              }`}
            >
              {option === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => switchMode('signin')}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-sm text-bone-300 transition-colors hover:text-bone-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
        </button>
      )}

      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight text-bone-50">
        {copy.title}
      </h1>
      <p className="mt-2 text-base leading-relaxed text-bone-300">{copy.lead}</p>

      {!auth.configured && (
        <p className={`mt-6 ${noticeError}`}>
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {auth.error}
        </p>
      )}

      <form onSubmit={submit} className="mt-7 space-y-5">
        <div>
          <label htmlFor="email" className={fieldLabel}>Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${fieldInput} mt-2`}
          />
        </div>
        {usesPassword && (
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            aside={mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="py-0.5 text-sm text-signal-300 transition-colors hover:text-signal-200 hover:underline"
              >
                Forgot password?
              </button>
            )}
          />
        )}

        {error && (
          <p role="alert" className={noticeError}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
        {message && (
          <p role="status" className={noticeSuccess}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {message}
          </p>
        )}

        <button type="submit" disabled={busy || !auth.configured} className={`${buttonPrimary} min-h-12 w-full text-base`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {copy.submit}
        </button>
      </form>

      {usesPassword && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-bone-400">
            <span className="h-px flex-1 bg-bone-600/30" aria-hidden />
            or
            <span className="h-px flex-1 bg-bone-600/30" aria-hidden />
          </div>
          <div className="grid gap-3">
            <button type="button" onClick={() => switchMode('magic')} className={`${buttonSecondary} w-full`}>
              <Mail className="h-4 w-4" aria-hidden /> Email me a sign-in link
            </button>
            {auth.googleEnabled && (
              <button type="button" onClick={() => void auth.signInWithGoogle()} className={`${buttonSecondary} w-full`}>
                Continue with Google
              </button>
            )}
          </div>
        </>
      )}
    </AuthFrame>
  );
}
