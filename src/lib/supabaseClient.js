import { createClient } from '@supabase/supabase-js';

// Values come from Vercel -> Project Settings -> Environment Variables
// (local dev: .env.local). Vite only exposes variables that start with VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Do NOT throw at import time: a throw here happens before React starts and
// leaves a blank/black page. App.jsx shows a readable setup message instead.
export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing Supabase settings. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel (Project Settings -> Environment Variables), then redeploy.'
    : null;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for OAuth redirect + email verification links
    },
  }
);
