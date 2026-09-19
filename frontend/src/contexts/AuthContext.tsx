import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { configureTokenProvider } from '@/lib/session';
import { authConfigured, localAuthEnabled, supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  sendMagicLink(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LOCAL_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'local@aegis.invalid',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
} as User;

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Authentication failed.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authConfigured);
  const [error, setError] = useState<string | null>(
    authConfigured || localAuthEnabled
      ? null
      : 'Authentication is not configured for this deployment.',
  );
  const token = useRef<string | null>(null);

  useEffect(() => {
    configureTokenProvider(async () => token.current);
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      token.current = data.session?.access_token ?? null;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      token.current = next?.access_token ?? null;
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
    return { confirmationRequired: !data.session };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (otpError) {
      setError(otpError.message);
      throw otpError;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      throw oauthError;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    }
    token.current = null;
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user: localAuthEnabled ? LOCAL_USER : session?.user ?? null,
    loading,
    configured: authConfigured || localAuthEnabled,
    error,
    signIn: async (email, password) => {
      try {
        await signIn(email, password);
      } catch (cause) {
        throw new Error(messageFrom(cause));
      }
    },
    signUp,
    sendMagicLink,
    signInWithGoogle,
    signOut,
  }), [error, loading, sendMagicLink, session, signIn, signInWithGoogle, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Provider and hook intentionally share this module so they cannot drift apart.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
