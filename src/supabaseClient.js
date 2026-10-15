/**
 * Supabase Client Configuration & Initialization
 * Connects the portfolio website to Supabase Auth and database services.
 *
 * Environment Variables (Vite):
 * - VITE_SUPABASE_URL: Your Supabase Project URL (e.g. https://xyzcompany.supabase.co)
 * - VITE_SUPABASE_ANON_KEY: Your Supabase Publishable / Anon API Key
 */
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const supabaseUrl = rawSupabaseUrl
  .trim()
  .replace(/\/auth\/v1\/callback\/?$/, '')
  .replace(/\/+$/, '');
const supabaseAnonKey = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '').trim();

/**
 * Check if valid Supabase credentials have been configured.
 */
export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project') &&
    supabaseAnonKey !== 'your-anon-key' &&
    supabaseAnonKey.length > 20
  );
};

/**
 * Singleton Supabase Client instance
 * Uses PKCE OAuth flow for robust redirect-based authentication with Google.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: window.localStorage
      }
    })
  : null;

export const getSupabaseConfig = () => ({
  url: supabaseUrl || null,
  isConfigured: isSupabaseConfigured(),
  callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/auth.html` : ''
});
