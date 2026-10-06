import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const authConfigured = Boolean(url && publishableKey);
export const localAuthEnabled = import.meta.env.VITE_AUTH_DISABLED === '1';

export const supabase = authConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Which OAuth providers the Supabase project has switched on, from its public settings. */
export async function enabledOAuthProviders(): Promise<Record<string, boolean>> {
  if (!authConfigured) return {};
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey! } });
  if (!response.ok) return {};
  const settings = (await response.json()) as { external?: Record<string, boolean> };
  return settings.external ?? {};
}
