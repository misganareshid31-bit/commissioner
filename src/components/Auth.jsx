import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  ArrowLeft, Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail,
  ShieldCheck, UserRound
} from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 30;
const AUTH_TIMEOUT_MS = 10000;

const withTimeout = (promise) => Promise.race([
  promise,
  new Promise(resolve => setTimeout(
    () => resolve({ data: null, error: { message: 'The request timed out. Check your connection and try again.' } }),
    AUTH_TIMEOUT_MS
  )),
]);

const isRateLimitMessage = (message = '') => {
  const s = message.toLowerCase();
  return s.includes('rate') || s.includes('too many') || s.includes('seconds');
};

const isUnconfirmedEmailMessage = (message = '') => {
  const s = message.toLowerCase();
  return s.includes('not confirmed') || s.includes('confirm your email') || s.includes('email not verified');
};

const scorePassword = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

function PasswordMeter({ password }) {
  if (!password) return null;
  const score = scorePassword(password);
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  return (
    <div className="cm-password-meter">
      <div className="cm-password-bars">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className={i < score ? 'is-filled' : ''} />
        ))}
      </div>
      <span>{labels[score]}</span>
    </div>
  );
}

const Field = ({ icon: Icon, ...props }) => (
  <label className="cm-auth-field">
    <Icon size={17} aria-hidden="true" />
    <input {...props} />
  </label>
);

export default function Auth({ onAuthenticated }) {
  const [intendedRole] = useState(() => sessionStorage.getItem('commissioner_intended_role'));
  const [mode, setMode] = useState(() => intendedRole ? 'signup' : 'signin');
  const [role, setRole] = useState(() => intendedRole === 'business' ? 'business' : 'creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState(null);
  const [checkContext, setCheckContext] = useState('signup');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    sessionStorage.removeItem('commissioner_intended_role');
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession && onAuthenticated) {
        onAuthenticated(nextSession, intendedRole ? role : undefined);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [onAuthenticated, intendedRole, role]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setInterval(() => setCooldown(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const clearMessages = () => { setError(''); setNotice(''); };

  const sendConfirmation = async (targetEmail, silent = false) => {
    if (cooldown) return;
    clearMessages();
    setLoading(true);
    const { error: resendError } = await withTimeout(
      supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: window.location.origin + '/' },
      })
    );
    setLoading(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);

    if (resendError) {
      setError(isRateLimitMessage(resendError.message) ? 'Too many attempts. Please wait a minute and try again.' : resendError.message);
      return;
    }
    setCheckContext('signup');
    setMode('check-email');
    if (silent) setNotice('Your email is not confirmed yet. A fresh confirmation link has been sent.');
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    clearMessages();

    const score = scorePassword(password);
    if (score < 3) {
      setError('Choose a stronger password with upper/lowercase letters, a number, and a symbol.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    const { data, error: signUpError } = await withTimeout(
      supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { role },
          emailRedirectTo: window.location.origin + '/',
        },
      })
    );
    setLoading(false);

    if (signUpError) {
      const msg = signUpError.message || 'We could not create your account.';
      if (isRateLimitMessage(msg)) setCooldown(RESEND_COOLDOWN_SECONDS);
      const lower = msg.toLowerCase();
      if (lower.includes('redirect') || lower.includes('url')) {
        setError(`Supabase blocked the email redirect. Add ${window.location.origin}/ to Authentication → URL Configuration → Redirect URLs.`);
      } else if (lower.includes('smtp') || lower.includes('confirmation')) {
        setError('The account reached Supabase, but email delivery is not configured correctly. Check Authentication → SMTP / email settings.');
      } else {
        setError(msg);
      }
      return;
    }

    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('An account with this email already exists. Sign in or use Forgot password.');
      return;
    }

    setEmail(normalizedEmail);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCheckContext('signup');
    setMode('check-email');
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    clearMessages();

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    const { error: signInError } = await withTimeout(
      supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    );
    setLoading(false);

    if (!signInError) return;

    const msg = signInError.message || 'Sign in failed.';
    if (isUnconfirmedEmailMessage(msg)) {
      setEmail(normalizedEmail);
      await sendConfirmation(normalizedEmail, true);
      return;
    }
    if (isRateLimitMessage(msg)) setCooldown(RESEND_COOLDOWN_SECONDS);
    setError(isRateLimitMessage(msg) ? 'Too many attempts. Please wait a minute and try again.' : msg);
  };

  const handleReset = async (event) => {
    event.preventDefault();
    clearMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter the email address used for your Commissioner account.');
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await withTimeout(
      supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
    );
    setLoading(false);

    if (resetError) {
      const msg = resetError.message || 'We could not send the reset email.';
      const lower = msg.toLowerCase();
      if (lower.includes('redirect') || lower.includes('url')) {
        setError(`Add ${redirectTo} to Supabase Authentication → URL Configuration → Redirect URLs.`);
      } else if (isRateLimitMessage(msg)) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        setError(msg);
      }
      return;
    }

    setEmail(normalizedEmail);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCheckContext('reset');
    setMode('check-email');
  };

  const resendFromCheck = async () => {
    if (cooldown) return;
    if (checkContext === 'reset') {
      clearMessages();
      setLoading(true);
      const { error: resetError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      );
      setLoading(false);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      if (resetError) setError(isRateLimitMessage(resetError.message) ? 'Too many attempts. Please wait a minute and try again.' : resetError.message);
    } else {
      await sendConfirmation(email);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const handleSignOutAll = async () => { await supabase.auth.signOut({ scope: 'global' }); };

  if (session) {
    return (
      <div className="cm-auth-card cm-auth-signed-in">
        <div className="cm-auth-brand">
          <img src="/assets/commissioner-mark-transparent-sm.png" alt="" />
          <span>Commissioner</span>
        </div>
        <CheckCircle2 size={28} className="cm-auth-success-icon" />
        <h2>You're signed in</h2>
        <p className="cm-auth-muted">{session.user.email}</p>
        <div className="cm-auth-actions">
          <button type="button" className="cm-auth-secondary" onClick={handleSignOut}>Sign out</button>
          <button type="button" className="cm-auth-danger" onClick={handleSignOutAll}>Sign out everywhere</button>
        </div>
      </div>
    );
  }

  if (mode === 'check-email') {
    const reset = checkContext === 'reset';
    return (
      <div className="cm-auth-card">
        <div className="cm-auth-brand">
          <img src="/assets/commissioner-mark-transparent-sm.png" alt="" />
          <span>Commissioner</span>
        </div>
        <div className="cm-auth-icon"><Mail size={22} /></div>
        <h1>{reset ? 'Check your email' : 'Verify your email'}</h1>
        <p className="cm-auth-subtitle">
          {reset
            ? <>We sent a secure password-reset link to <strong>{email}</strong>.</>
            : <>We sent a confirmation link to <strong>{email}</strong>. Open it to activate your Commissioner account.</>}
        </p>
        <div className="cm-auth-info">Nothing arrived? Check Spam/Junk. You can safely request another email after the timer ends.</div>
        {error && <div className="cm-auth-error" role="alert">{error}</div>}
        {notice && !error && <div className="cm-auth-notice">{notice}</div>}
        <div className="cm-auth-actions">
          <button type="button" className="cm-auth-primary" disabled={loading || cooldown > 0} onClick={resendFromCheck}>
            {loading ? 'Sending…' : cooldown ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>
          <button type="button" className="cm-auth-secondary" onClick={() => { setMode(reset ? 'reset' : 'signup'); clearMessages(); }}>
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'reset') {
    return (
      <div className="cm-auth-card">
        <div className="cm-auth-brand">
          <img src="/assets/commissioner-mark-transparent-sm.png" alt="" />
          <span>Commissioner</span>
        </div>
        <h1>Reset your password</h1>
        <p className="cm-auth-subtitle">Enter your email and we'll send you a secure reset link.</p>
        <form onSubmit={handleReset} className="cm-auth-form">
          <Field icon={Mail} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required />
          {error && <div className="cm-auth-error" role="alert">{error}</div>}
          <button className="cm-auth-primary" disabled={loading || cooldown > 0}>
            {loading ? 'Sending…' : cooldown ? `Wait ${cooldown}s` : 'Send reset link'}
          </button>
        </form>
        <button type="button" className="cm-auth-link" onClick={() => { setMode('signin'); clearMessages(); }}>
          <ArrowLeft size={15} /> Back to sign in
        </button>
      </div>
    );
  }

  const signup = mode === 'signup';

  return (
    <div className="cm-auth-card">
      <div className="cm-auth-brand">
        <img src="/assets/commissioner-mark-transparent-sm.png" alt="" />
        <span>Commissioner</span>
      </div>

      <div className="cm-auth-heading">
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signup ? 'Build your professional Commissioner identity.' : 'Sign in to continue to your workspace.'}</p>
      </div>

      <div className="cm-auth-tabs" role="tablist">
        <button type="button" className={!signup ? 'is-active' : ''} onClick={() => { setMode('signin'); clearMessages(); }}>
          Sign in
        </button>
        <button type="button" className={signup ? 'is-active' : ''} onClick={() => { setMode('signup'); clearMessages(); }}>
          Sign up
        </button>
      </div>

      {signup && (
        <div className="cm-auth-role-grid">
          <button type="button" className={role === 'creator' ? 'is-active creator' : ''} onClick={() => setRole('creator')}>
            <UserRound size={17} />
            <span><strong>Creator</strong><small>For your personal brand</small></span>
          </button>
          <button type="button" className={role === 'business' ? 'is-active business' : ''} onClick={() => setRole('business')}>
            <Building2 size={17} />
            <span><strong>Business</strong><small>For your company</small></span>
          </button>
        </div>
      )}

      <form onSubmit={signup ? handleSignUp : handleSignIn} className="cm-auth-form">
        <Field icon={Mail} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required />
        <label className="cm-auth-field">
          <LockKeyhole size={17} aria-hidden="true" />
          <input
            required type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Password"
            minLength={8} autoComplete={signup ? 'new-password' : 'current-password'}
          />
          <button type="button" className="cm-auth-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </label>

        {signup && <PasswordMeter password={password} />}

        {!signup && (
          <button type="button" className="cm-auth-forgot" onClick={() => { setMode('reset'); clearMessages(); }}>
            Forgot password?
          </button>
        )}

        {cooldown > 0 && <div className="cm-auth-notice">Please wait {cooldown}s before requesting another email.</div>}
        {error && <div className="cm-auth-error" role="alert">{error}</div>}
        {notice && !error && <div className="cm-auth-notice">{notice}</div>}

        <button className="cm-auth-primary cm-auth-submit" disabled={loading || cooldown > 0}>
          {loading ? (signup ? 'Creating account…' : 'Signing in…') : (signup ? 'Create account' : 'Sign in')}
        </button>
      </form>

      <div className="cm-auth-footer">
        <ShieldCheck size={15} />
        <span>Your account is protected by Supabase Authentication.</span>
      </div>
    </div>
  );
}
