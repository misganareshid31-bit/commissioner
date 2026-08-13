import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Eye, EyeOff, User, Building2 } from 'lucide-react';
import { Button, Input } from './ui';

function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['#DC2626', '#DC2626', '#D97706', '#D97706', '#0E7A3B', '#0E7A3B'];

export default function AuthPage() {
  const [mode, setMode] = useState('signin'); // signin | signup | reset
  const [role, setRole] = useState('creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPath = params.get('next') || '/dashboard';

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (scorePassword(password) < 3) {
      setError('Please choose a stronger password.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { role } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.session) {
      // No verification gate — go straight to setting up the profile.
      navigate(nextPath);
    } else {
      setMessage('Account created. Check your email to confirm, then sign in — or your admin can verify you manually.');
      setMode('signin');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    navigate(nextPath);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMessage('Password reset email sent.');
  };

  return (
    <div className="max-w-sm mx-auto bg-white border rounded-2xl p-6" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex border rounded-lg p-1 mb-5" style={{ borderColor: '#E5E7EB' }}>
        {['signin', 'signup'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(''); setMessage(''); }}
            className="flex-1 text-sm font-semibold py-2 rounded-md"
            style={{ background: mode === m ? '#111827' : 'transparent', color: mode === m ? 'white' : '#374151' }}>
            {m === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      {mode === 'signup' && (
        <div className="flex gap-2 mb-4">
          {[{ id: 'creator', label: 'Creator', icon: User }, { id: 'business', label: 'Business', icon: Building2 }].map(r => (
            <button key={r.id} type="button" onClick={() => setRole(r.id)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold border rounded-lg py-2.5"
              style={{
                borderColor: role === r.id ? '#E6007A' : '#E5E7EB',
                background: role === r.id ? '#FDE7F1' : 'white',
                color: role === r.id ? '#99154F' : '#374151',
              }}>
              <r.icon size={15} /> {r.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'reset' ? (
        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" icon={Mail} />
          {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          {message && <p className="text-xs" style={{ color: '#0E7A3B' }}>{message}</p>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Sending…' : 'Send reset link'}</Button>
          <button type="button" onClick={() => setMode('signin')} className="text-xs font-semibold text-center" style={{ color: '#6B7280' }}>Back to sign in</button>
        </form>
      ) : (
        <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="flex flex-col gap-3">
          <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" icon={Mail} />
          <div className="relative">
            <Input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" icon={Lock} />
            <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2">
              {showPassword ? <EyeOff size={15} style={{ color: '#6B7280' }} /> : <Eye size={15} style={{ color: '#6B7280' }} />}
            </button>
          </div>
          {mode === 'signup' && password && (
            <div>
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < scorePassword(password) ? STRENGTH_COLORS[scorePassword(password)] : '#E5E7EB' }} />
                ))}
              </div>
              <p className="text-xs" style={{ color: STRENGTH_COLORS[scorePassword(password)] }}>{STRENGTH_LABELS[scorePassword(password)]}</p>
            </div>
          )}
          {mode === 'signin' && (
            <button type="button" onClick={() => setMode('reset')} className="text-xs font-semibold text-left" style={{ color: '#036377' }}>Forgot password?</button>
          )}
          {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          {message && <p className="text-xs" style={{ color: '#0E7A3B' }}>{message}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      )}
    </div>
  );
}
