import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, TriangleAlert } from 'lucide-react';
import { AuthFrame, PasswordField } from '@/components/AuthFrame';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/contexts/AuthContext';
import { buttonPrimary, buttonSecondary, noticeError } from '@/lib/ui';

/** Supabase puts the reason in the address fragment when a link has expired or was already used. */
function linkProblem() {
  return new URLSearchParams(window.location.hash.slice(1)).get('error_description');
}

/**
 * Where a password-reset email lands. The link has already signed the visitor in,
 * so all that is left is the new password. A signed-in visitor can change theirs
 * here too, from Profile.
 */
export default function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [problem] = useState(linkProblem);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.updatePassword(password);
      toast.success('Password updated', 'Use your new password the next time you sign in.');
      navigate('/app', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The password could not be changed.');
      setBusy(false);
    }
  };

  if (auth.loading) {
    return (
      <AuthFrame>
        <p role="status" className="flex items-center gap-2 text-sm text-bone-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your reset link…
        </p>
      </AuthFrame>
    );
  }

  if (!auth.user) {
    return (
      <AuthFrame>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-bone-50">
          This reset link has expired
        </h1>
        <p className="mt-2 text-base leading-relaxed text-bone-300">
          {problem ? `${problem}. ` : ''}Each link works once. Ask for a new one and open the newest email.
        </p>
        <div className="mt-7 grid gap-3">
          <Link to="/auth?mode=forgot" className={`${buttonPrimary} min-h-12 w-full text-base`}>Send a new link</Link>
          <Link to="/auth" className={`${buttonSecondary} w-full`}>Back to sign in</Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-bone-50">
        {auth.passwordRecovery ? 'Choose a new password' : 'Change your password'}
      </h1>
      <p className="mt-2 break-words text-base leading-relaxed text-bone-300">
        For <span className="text-bone-50">{auth.user.email}</span>. Pick one you don’t use anywhere else.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-5">
        {/* Lets a password manager file the new password under the right account. */}
        <input type="email" autoComplete="username" value={auth.user.email ?? ''} readOnly hidden />
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters."
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={8}
        />
        {error && (
          <p role="alert" className={noticeError}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${buttonPrimary} min-h-12 w-full text-base`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Update password
        </button>
      </form>
      <Link to="/app" className={`${buttonSecondary} mt-3 w-full`}>
        {auth.passwordRecovery ? 'Skip for now' : 'Cancel'}
      </Link>
    </AuthFrame>
  );
}
