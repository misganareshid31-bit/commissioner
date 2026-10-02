import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!supabaseConfigured) {
  // Logged for developers only; the UI shows a friendly notice (see main.jsx).
  console.error('Commissioner: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.');
}

// A placeholder URL keeps imports safe so the app can render a friendly
// "temporarily unavailable" screen instead of a blank page.
export const supabase = createClient(
  supabaseUrl || 'https://not-configured.invalid',
  supabaseKey || 'not-configured',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
