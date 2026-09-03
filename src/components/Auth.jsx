import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, User, Building2 } from 'lucide-react';

/* -------------------- password strength -------------------- */

function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['#DC2626', '#DC2626', '#D97706', '#D97706', '#0E7A3B', '#0E7A3B'];

const PasswordStrengthMeter = ({ password }) => {
  const score = scorePassword(password);
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < score ? STRENGTH_COLORS[score] : '#E5E7EB' }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: STRENGTH_COLORS[score] }}>{STRENGTH_LABELS[score]}</p>
    </div>
  );
};

/* -------------------- Google button -------------------- */

const GoogleButton = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
    style={{ borderColor: '#E5E7EB', color: '#374151' }}
  >
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.4 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.8 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.4 29.5 3 24 3c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 45c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.4 35.9 26.8 37 24 37c-5.3 0-9.8-3.3-11.4-8H6v6.6C9.3 40.6 16.1 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.4C41.8 35.9 45 30.5 45 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
    Continue with Google
  </button>
);

/* -------------------- main component -------------------- */

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState(() => (sessionStorage.getItem('commissioner_intended_role') ? 'signup' : 'signin'));
  const [role, setRole] = useState(() => (sessionStorage.getItem('commissioner_intended_role') === 'business' ? 'business' : 'creator'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);

  useEffect(() => {
    sessionStorage.removeItem('commissioner_intended_role');
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess && onAuthenticated) onAuthenticated(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, [onAuthenticated]);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);

    // Supabase requires this exact URL to be present in
    // Authentication → URL Configuration → Redirect URLs.
    // Keep it simple for this Vite SPA: return to the same page after OAuth.
    const redirectTo = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      setLoading(false);
      const message = error.message || 'Google sign-in could not be started.';
      const lower = message.toLowerCase();

      if (lower.includes('provider') && (lower.includes('not enabled') || lower.includes('unsupported'))) {
        setError('Google sign-in is not enabled in Supabase yet. Enable Google under Authentication → Providers, then add your Google OAuth Client ID and Client Secret.');
      } else if (lower.includes('redirect') || lower.includes('url')) {
        setError(`Google sign-in was blocked by the redirect URL configuration. Add ${redirectTo} to Supabase Authentication → URL Configuration → Redirect URLs.`);
      } else {
        setError(`Google sign-in failed: ${message}`);
      }
      return;
    }

    // signInWithOAuth normally redirects immediately. If a browser blocks
    // the redirect for any reason, surface a useful message instead of
    // leaving the button apparently frozen.
    if (!data?.url) {
      setLoading(false);
      setError('Supabase did not return a Google authorization URL. Check that the Google provider is enabled and configured.');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    const score = scorePassword(password);
    if (score < 3) {
      setError('Please choose a stronger password (mix upper/lowercase, numbers, and a symbol).');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Stored on the auth.users row; read this in a DB trigger to create
        // the matching row in creator_profiles or business_profiles.
        data: { role },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    // Supabase sends a verification email automatically when email
    // confirmations are enabled in Authentication settings.
    setMode('check-email');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMode('check-email');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSignOutAllDevices = async () => {
    await supabase.auth.signOut({ scope: 'global' });
  };

  /* ---- already signed in ---- */
  if (session) {
    return (
      <div className="max-w-sm mx-auto bg-white border rounded-2xl p-6" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} style={{ color: '#0E7A3B' }} />
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Signed in as {session.user.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSignOut} className="flex-1 text-sm font-semibold border rounded-lg py-2" style={{ borderColor: '#E5E7EB' }}>
            Sign out
          </button>
          <button onClick={handleSignOutAllDevices} className="flex-1 text-sm font-semibold border rounded-lg py-2" style={{ borderColor: '#E5E7EB', color: '#DC2626' }}>
            Sign out all devices
          </button>
        </div>
      </div>
    );
  }

  /* ---- check your email ---- */
  if (mode === 'check-email') {
    return (
      <div className="max-w-sm mx-auto bg-white border rounded-2xl p-6 text-center" style={{ borderColor: '#E5E7EB' }}>
        <Mail size={28} className="mx-auto mb-3" style={{ color: '#00A8CC' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Check your email</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>We sent a link to {email}. Click it to continue.</p>
        <button onClick={() => setMode('signin')} className="text-xs font-semibold mt-4" style={{ color: '#E6007A' }}>
          Back to sign in
        </button>
      </div>
    );
  }

  /* ---- forgot password ---- */
  if (mode === 'reset') {
    return (
      <form onSubmit={handleResetRequest} className="max-w-sm mx-auto bg-white border rounded-2xl p-6" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Reset your password</p>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5 mb-4" style={{ borderColor: '#E5E7EB' }}>
          <Mail size={15} style={{ color: '#6B7280' }} />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 outline-none text-sm" />
        </div>
        {error && <p className="text-xs mb-3" style={{ color: '#DC2626' }}>{error}</p>}
        <button disabled={loading} style={{ background: '#E6007A' }} className="w-full text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        <button type="button" onClick={() => setMode('signin')} className="text-xs font-semibold mt-3 w-full text-center" style={{ color: '#6B7280' }}>
          Back to sign in
        </button>
      </form>
    );
  }

  /* ---- sign in / sign up ---- */
  return (
    <div className="max-w-sm mx-auto bg-white border rounded-2xl p-6" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex border rounded-lg p-1 mb-5" style={{ borderColor: '#E5E7EB' }}>
        {['signin', 'signup'].map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(''); }}
            className="flex-1 text-sm font-semibold py-2 rounded-md"
            style={{ background: mode === m ? '#111827' : 'transparent', color: mode === m ? 'white' : '#374151' }}
          >
            {m === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      {mode === 'signup' && (
        <div className="flex gap-2 mb-4">
          {[
            { id: 'creator', label: 'Creator', icon: User },
            { id: 'business', label: 'Business', icon: Building2 },
          ].map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold border rounded-lg py-2.5"
              style={{
                borderColor: role === r.id ? '#E6007A' : '#E5E7EB',
                background: role === r.id ? '#FDE7F1' : 'white',
                color: role === r.id ? '#99154F' : '#374151',
              }}
            >
              <r.icon size={15} /> {r.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn}>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5 mb-3" style={{ borderColor: '#E5E7EB' }}>
          <Mail size={15} style={{ color: '#6B7280' }} />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 outline-none text-sm" />
        </div>

        <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5" style={{ borderColor: '#E5E7EB' }}>
          <Lock size={15} style={{ color: '#6B7280' }} />
          <input
            required
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            minLength={8}
            className="flex-1 outline-none text-sm"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={15} style={{ color: '#6B7280' }} /> : <Eye size={15} style={{ color: '#6B7280' }} />}
          </button>
        </div>

        {mode === 'signup' && <PasswordStrengthMeter password={password} />}

        {mode === 'signin' && (
          <button type="button" onClick={() => setMode('reset')} className="text-xs font-semibold mt-2" style={{ color: '#036377' }}>
            Forgot password?
          </button>
        )}

        {error && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{error}</p>}

        <button disabled={loading} style={{ background: '#E6007A' }} className="w-full text-white text-sm font-semibold py-2.5 rounded-lg mt-4 disabled:opacity-50">
          {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
