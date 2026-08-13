import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Navbar({ session }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { to: '/creators', label: 'Discover creators' },
    { to: '/businesses', label: 'Businesses' },
  ];

  const handleSignOut = async () => {
    setAccountOpen(false);
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b" style={{ borderColor: '#E5E7EB' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg cm-beam flex items-center justify-center">
            <span className="cm-display text-white font-bold text-sm">C</span>
          </div>
          <span className="cm-display font-bold text-lg" style={{ color: '#111827' }}>Commissioner</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.to} to={l.to} className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ color: '#374151' }}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button onClick={() => setAccountOpen(o => !o)} className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg" style={{ color: '#111827' }}>
                <span style={{ background: '#0E7A3B' }} className="w-2 h-2 rounded-full" />
                {session.user.email}
                <ChevronDown size={14} style={{ color: '#6B7280' }} />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border rounded-xl shadow-lg py-1.5 z-50" style={{ borderColor: '#E5E7EB' }}>
                  <Link to="/dashboard" onClick={() => setAccountOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#111827' }}>Dashboard</Link>
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#DC2626' }}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth" className="text-sm font-medium px-3 py-2" style={{ color: '#111827' }}>Sign in</Link>
          )}
          <Link to="/creators" style={{ background: '#E6007A' }} className="text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Hire creators
          </Link>
          <Link to={session ? '/dashboard' : '/auth'} style={{ borderColor: '#00D9FF', color: '#036377' }} className="border-2 text-sm font-semibold px-3.5 py-1.5 rounded-lg">
            Join
          </Link>
        </div>

        <button className="lg:hidden" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t px-5 py-3 flex flex-col gap-1" style={{ borderColor: '#E5E7EB' }}>
          {links.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: '#374151' }}>
              {l.label}
            </Link>
          ))}
          {session ? (
            <>
              <div className="px-3 py-2 text-xs font-semibold" style={{ color: '#6B7280' }}>{session.user.email}</div>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: '#374151' }}>Dashboard</Link>
              <button onClick={() => { handleSignOut(); setMenuOpen(false); }} className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold" style={{ color: '#DC2626' }}>Sign out</button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-semibold" style={{ color: '#E6007A' }}>Sign in</Link>
          )}
        </div>
      )}
    </header>
  );
}
