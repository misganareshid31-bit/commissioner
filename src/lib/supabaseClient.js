import { createClient } from '@supabase/supabase-js';

// These come from environment variables — never hardcode real values here.
// Vite: prefix with VITE_ and read via import.meta.env
// Next.js: prefix with NEXT_PUBLIC_ and read via process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Supabase publishable keys are the preferred public browser key.
// Keep the legacy anon variable as a backwards-compatible fallback.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env.local file for VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for OAuth redirect + email verification links
  },
});
