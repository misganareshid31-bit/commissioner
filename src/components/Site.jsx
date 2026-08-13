import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Auth from './Auth';
import {
  Search, MapPin, CheckCircle2, TrendingUp, Users, MessageSquare, Bell,
  Star, Play, Instagram, Youtube, Facebook, Send, Paperclip, Mic,
  ChevronRight, ChevronDown, Zap, Shield, BarChart3, Briefcase,
  Menu, X, SlidersHorizontal, ArrowUpRight, Clock, DollarSign,
  Calendar, ImageIcon, FileText, MoreHorizontal, Wallet, Award,
  UserCheck, Building2, Sparkles, ArrowRight, Flame, Camera, Globe,
  Phone, Upload, ChevronLeft, Check, Video, Link2, Languages,
  LogOut, Settings, ImagePlus, AtSign
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid
} from 'recharts';

/* ---------------------------------- fonts / tokens ---------------------------------- */

const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap');
    .cm-root, .cm-root * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
    .cm-display { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; }
    .cm-mono { font-family: 'IBM Plex Mono', monospace; letter-spacing: -0.01em; }
    .cm-beam { background: linear-gradient(90deg, #E6007A 0%, #00D9FF 100%); }
    .cm-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
    .cm-scroll::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }
    .cm-card-hover { transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease; }
    .cm-card-hover:hover { box-shadow: 0 8px 30px rgba(17,24,39,0.08); transform: translateY(-2px); border-color: #E5E7EB; }
    .cm-beam-reveal { opacity: 0; transform: scaleX(0.4); transform-origin: left; transition: all 0.3s ease; }
    .cm-card-hover:hover .cm-beam-reveal { opacity: 1; transform: scaleX(1); }
    @keyframes cm-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    .cm-live-dot { animation: cm-pulse 1.8s ease-in-out infinite; }
  `}</style>
);

/* ---------------------------------- mock data ---------------------------------- */

const AVATAR_PALETTE = [
  ['#FDE7F1', '#99154F'], ['#E0FBFF', '#036377'], ['#FFF1E5', '#9A4A0C'],
  ['#EFEAFE', '#5136A8'], ['#E9FBEF', '#0E7A3B'], ['#FEEBEB', '#A32D2D'],
];

const Avatar = ({ name, size = 44, tone = 0, ring = false, src }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const [bg, fg] = AVATAR_PALETTE[tone % AVATAR_PALETTE.length];
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: ring ? '2px solid #00D9FF' : 'none' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36, flexShrink: 0,
      border: ring ? '2px solid #00D9FF' : 'none'
    }} className="cm-display">
      {initials}
    </div>
  );
};

// Campaigns, messages, and spotlight videos don't have a creation flow yet,
// so they stay empty until that's built. Creators are different — anyone
// who finishes onboarding should actually show up, so we fetch them live.
const CAMPAIGNS = [];
const CONVERSATIONS = [];
const SPOTLIGHT_VIDEOS = [];

function firstNonEmpty(obj, keys) {
  for (const k of keys) if (obj && obj[k]) return obj[k];
  return null;
}

// Fetches published creator profiles from Supabase and adapts them to the
// shape CreatorCard expects. Returns [] if none exist yet — callers should
// render an empty state rather than assume data is present.
async function fetchLiveCreators(limit = 48) {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('id, page_name, username, avatar_url, city, primary_niche, platforms, services, verified')
    .eq('onboarded', true)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row, i) => {
    const socials = row.platforms && typeof row.platforms === 'object' ? row.platforms : {};
    const platformKeys = Object.keys(socials).filter(p => socials[p]?.handle);
    const first = socials[platformKeys[0]];
    const price = firstNonEmpty(row.services, ['reel', 'story', 'tiktok', 'youtube', 'ugc', 'monthly']);
    return {
      id: row.id,
      name: row.page_name || row.username || 'Creator',
      handle: row.username ? (row.username.startsWith('@') ? row.username : `@${row.username}`) : '',
      niche: row.primary_niche || 'Creator',
      city: row.city || '',
      followers: first?.followers || '—',
      engagement: first?.engagement || '—',
      price: price || null,
      platforms: platformKeys.map(p => p.toLowerCase()),
      verified: !!row.verified,
      response: null,
      tone: i,
      avatarUrl: row.avatar_url,
    };
  });
}

const NICHES = ['Food & Restaurants', 'Fashion', 'Beauty', 'Technology', 'Gaming', 'Fitness', 'Travel', 'Comedy'];

const CREATOR_PLANS = [
  { id: 'basic', name: 'Basic', price: '$1', period: '/month', features: ['Profile', 'Portfolio', 'Social links', '3 Spotlight videos'], tone: 'gray' },
  { id: 'pro', name: 'Pro', price: '$10', period: '/month', features: ['Priority listing', 'Analytics', 'QR card', '20 Spotlight videos'], tone: 'cyan', popular: true },
  { id: 'elite', name: 'Elite NFC', price: '$20', period: '/month', features: ['NFC card', 'Premium badge', 'Unlimited videos', 'Top placement'], tone: 'magenta' },
];

const BUSINESS_PLANS = [
  { id: 'starter', name: 'Starter', price: '$5', period: '/month', features: ['Profile', 'Campaign posting'], tone: 'gray' },
  { id: 'growth', name: 'Growth', price: '$20', period: '/month', features: ['Unlimited campaigns', 'Advanced filters', 'Analytics', 'QR card'], tone: 'cyan', popular: true },
  { id: 'enterprise', name: 'Enterprise NFC', price: '$50', period: '/month', features: ['NFC business card', 'Premium placement', 'Multiple team members'], tone: 'magenta' },
];

const ONBOARDING_STEPS = ['Basic info', 'Social media', 'Niche (optional)', 'Audience', 'Services & pricing', 'Portfolio (optional)', 'Availability'];

/* ---------------------------------- shared bits ---------------------------------- */

const PlatformIcon = ({ p, size = 14 }) => {
  const props = { size, strokeWidth: 2 };
  if (p === 'instagram') return <Instagram {...props} />;
  if (p === 'youtube') return <Youtube {...props} />;
  if (p === 'facebook') return <Facebook {...props} />;
  return <span className="cm-display" style={{ fontSize: size, fontWeight: 700, lineHeight: 1 }}>♪</span>;
};

const VerifiedBadge = ({ label = 'Verified by Commissioner' }) => (
  <span
    title={label}
    style={{ background: '#E0FBFF', color: '#036377' }}
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
  >
    <CheckCircle2 size={12} strokeWidth={2.5} />
    Verified
  </span>
);

const StatusPill = ({ status }) => {
  const map = {
    Open: ['#E9FBEF', '#0E7A3B'],
    Reviewing: ['#FFF1E5', '#9A4A0C'],
    'In Progress': ['#E0FBFF', '#036377'],
    Completed: ['#F1EFE8', '#5F5E5A'],
    Closed: ['#FEEBEB', '#A32D2D'],
  };
  const [bg, fg] = map[status] || map.Open;
  return (
    <span style={{ background: bg, color: fg }} className="rounded-full px-2.5 py-1 text-[11px] font-semibold">
      {status}
    </span>
  );
};

const NavBar = ({ page, setPage, menuOpen, setMenuOpen, session }) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const links = [
    { id: 'home', label: 'Home' },
    { id: 'creators', label: 'Discover creators' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'messages', label: 'Messages' },
    { id: 'pricing', label: 'Pricing' },
  ];

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b" style={{ borderColor: '#E5E7EB' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <button onClick={() => setPage('home')} className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg cm-beam flex items-center justify-center">
            <span className="cm-display text-white font-bold text-sm">C</span>
          </div>
          <span className="cm-display font-bold text-lg" style={{ color: '#111827' }}>Commissioner</span>
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => setPage(l.id)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: page === l.id ? '#E6007A' : '#374151',
                background: page === l.id ? '#FDE7F1' : 'transparent'
              }}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen(o => !o)}
                className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg"
                style={{ color: '#111827', background: accountMenuOpen ? '#F8FAFC' : 'transparent' }}
              >
                <span style={{ background: '#0E7A3B' }} className="w-2 h-2 rounded-full" />
                {session.user.email}
                <ChevronDown size={14} style={{ color: '#6B7280' }} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border rounded-xl shadow-lg py-1.5 z-50" style={{ borderColor: '#E5E7EB' }}>
                  <button onClick={() => { setPage('dashboard'); setAccountMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#111827' }}>Dashboard</button>
                  <button onClick={() => { setPage('account'); setAccountMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#111827' }}>Account settings</button>
                  <div className="h-px my-1" style={{ background: '#E5E7EB' }} />
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#DC2626' }}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setPage('auth')} className="text-sm font-medium px-3 py-2" style={{ color: '#111827' }}>Sign in</button>
          )}
          <button
            onClick={() => setPage('creators')}
            style={{ background: '#E6007A' }}
            className="text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Hire creators
          </button>
          <button
            onClick={() => setPage(session ? 'onboarding' : 'auth')}
            style={{ borderColor: '#00D9FF', color: '#036377' }}
            className="border-2 text-sm font-semibold px-3.5 py-1.5 rounded-lg"
          >
            Join as a creator
          </button>
        </div>

        <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t px-5 py-3 flex flex-col gap-1" style={{ borderColor: '#E5E7EB' }}>
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => { setPage(l.id); setMenuOpen(false); }}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-medium"
              style={{ color: page === l.id ? '#E6007A' : '#374151', background: page === l.id ? '#FDE7F1' : 'transparent' }}
            >
              {l.label}
            </button>
          ))}
          {session ? (
            <>
              <div className="text-left px-3 py-2 text-xs font-semibold" style={{ color: '#6B7280' }}>{session.user.email}</div>
              <button onClick={() => { setPage('dashboard'); setMenuOpen(false); }} className="text-left px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: '#374151' }}>Dashboard</button>
              <button onClick={() => { setPage('account'); setMenuOpen(false); }} className="text-left px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: '#374151' }}>Account settings</button>
              <button onClick={async () => { await supabase.auth.signOut(); setMenuOpen(false); }} className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold" style={{ color: '#DC2626' }}>Sign out</button>
            </>
          ) : (
            <button
              onClick={() => { setPage('auth'); setMenuOpen(false); }}
              className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold"
              style={{ color: '#E6007A' }}
            >
              Sign in
            </button>
          )}
        </div>
      )}
    </header>
  );
};

const Footer = ({ setPage }) => (
  <footer style={{ background: '#111827' }} className="text-white mt-24">
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg cm-beam flex items-center justify-center">
            <span className="cm-display text-white font-bold text-sm">C</span>
          </div>
          <span className="cm-display font-bold text-lg">Commissioner</span>
        </div>
        <p className="text-sm max-w-xs" style={{ color: '#9CA3AF' }}>Where creators and businesses connect professionally.</p>
      </div>
      {[
        { h: 'Platform', items: ['Discover creators', 'Discover businesses', 'Campaigns', 'Spotlight'] },
        { h: 'Company', items: ['About', 'Contact', 'Pricing', 'Trust & safety'] },
        { h: 'Resources', items: ['Help center', 'NFC & QR cards', 'API status', 'Community'] },
      ].map(col => (
        <div key={col.h}>
          <p className="text-sm font-semibold mb-4">{col.h}</p>
          <ul className="space-y-2.5">
            {col.items.map(i => <li key={i} className="text-sm" style={{ color: '#9CA3AF' }}>{i}</li>)}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t px-5 md:px-8 py-6 flex flex-col md:flex-row justify-between gap-3" style={{ borderColor: '#1F2937' }}>
      <p className="text-xs" style={{ color: '#6B7280' }}>© 2026 Commissioner. All rights reserved.</p>
      <p className="text-xs" style={{ color: '#6B7280' }}>Prototype preview — mock data</p>
    </div>
  </footer>
);

/* ---------------------------------- creator card ---------------------------------- */

const CreatorCard = ({ c, saved = false, onToggleSave = () => {}, onHire = () => {} }) => (
  <div
    className="cm-card-hover bg-white rounded-2xl border p-5 flex flex-col gap-4"
    style={{ borderColor: '#E5E7EB' }}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <Avatar name={c.name} size={48} tone={c.tone} ring={c.verified} src={c.avatarUrl} />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm" style={{ color: '#111827' }}>{c.name}</p>
            {c.verified && <CheckCircle2 size={14} style={{ color: '#00A8CC' }} strokeWidth={2.5} />}
          </div>
          <p className="cm-mono text-xs" style={{ color: '#6B7280' }}>{c.handle}</p>
        </div>
      </div>
      <button onClick={() => onToggleSave(c.id)} style={{ color: saved ? '#E6007A' : '#6B7280' }} title={saved ? 'Saved' : 'Save'}>
        <Star size={18} fill={saved ? '#E6007A' : 'none'} />
      </button>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <span style={{ background: '#FDE7F1', color: '#99154F' }} className="text-[11px] font-semibold px-2.5 py-1 rounded-full">{c.niche}</span>
      <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}><MapPin size={12} />{c.city}</span>
    </div>

    <div className="flex items-center gap-2">
      {c.platforms.map(p => (
        <div key={p} style={{ color: '#00A8CC' }} className="w-7 h-7 rounded-lg flex items-center justify-center" >
          <div style={{ background: '#E0FBFF' }} className="w-7 h-7 rounded-lg flex items-center justify-center">
            <PlatformIcon p={p} />
          </div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
      <div>
        <p className="cm-mono text-sm font-semibold" style={{ color: '#111827' }}>{c.followers}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Followers</p>
      </div>
      <div>
        <p className="cm-mono text-sm font-semibold" style={{ color: '#111827' }}>{c.engagement}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Engagement</p>
      </div>
      <div>
        <p className="cm-mono text-sm font-semibold" style={{ color: '#111827' }}>{c.response ? `~${c.response}` : '—'}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Response</p>
      </div>
    </div>

    <div className="cm-beam-reveal h-px w-full cm-beam" />

    <div className="flex items-center justify-between pt-1">
      <div>
        <p className="cm-mono text-base font-semibold" style={{ color: '#111827' }}>{c.price ? `$${c.price}` : 'Rate on request'}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Starting price</p>
      </div>
      <button onClick={() => onHire(c)} style={{ background: '#E6007A' }} className="text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90">
        Hire
      </button>
    </div>
  </div>
);

/* ---------------------------------- pages ---------------------------------- */

const Home = ({ setPage }) => (
  <div>
    {/* hero */}
    <section className="max-w-7xl mx-auto px-5 md:px-8 pt-16 pb-10">
      <div className="max-w-3xl">
        <span style={{ background: '#FDE7F1', color: '#99154F' }} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Sparkles size={13} /> Now in early access
        </span>
        <h1 className="cm-display font-bold leading-[1.05] mb-6" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', color: '#111827' }}>
          Find the right creator for your business.
        </h1>
        <p className="text-lg mb-8 max-w-xl" style={{ color: '#374151' }}>
          Commissioner connects vetted creators with businesses for campaigns, UGC, and brand partnerships — built for people who take the work seriously.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          <button onClick={() => setPage('creators')} style={{ background: '#E6007A' }} className="text-white font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 flex items-center justify-center gap-2">
            Hire creators <ArrowRight size={16} />
          </button>
          <button onClick={() => setPage('onboarding')} style={{ borderColor: '#00D9FF', color: '#036377' }} className="border-2 font-semibold px-6 py-3.5 rounded-xl hover:bg-cyan-50">
            Join as a creator
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white border rounded-xl p-2 max-w-xl" style={{ borderColor: '#E5E7EB' }}>
          <Search size={18} style={{ color: '#6B7280' }} className="ml-2" />
          <input
            placeholder="Search by niche, platform, or city — e.g. Fashion in Dubai"
            className="flex-1 outline-none text-sm py-2"
          />
          <button style={{ background: '#111827' }} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg">Search</button>
        </div>
      </div>
    </section>

    {/* how it works */}
    <section style={{ background: '#F8FAFC' }} className="py-16">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <h2 className="cm-display font-bold text-2xl md:text-3xl mb-10 text-center" style={{ color: '#111827' }}>How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Search, t: 'Discover', d: 'Search and filter creators by niche, platform, city, and audience — or post a campaign and let creators come to you.' },
            { icon: MessageSquare, t: 'Collaborate', d: 'Message directly, agree on scope in a shared campaign workspace, and track approvals and revisions in one place.' },
            { icon: Wallet, t: 'Get results', d: 'Track delivery, ratings, and payment reliability so every collaboration builds trust for the next one.' },
          ].map((s, i) => (
            <div key={s.t} className="bg-white rounded-2xl border p-7" style={{ borderColor: '#E5E7EB' }}>
              <div style={{ background: '#E0FBFF' }} className="w-11 h-11 rounded-xl flex items-center justify-center mb-5">
                <s.icon size={20} style={{ color: '#036377' }} />
              </div>
              <h3 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>{s.t}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
      <div className="rounded-3xl p-10 md:p-14 relative overflow-hidden" style={{ background: '#111827' }}>
        <div className="relative max-w-lg">
          <h2 className="cm-display font-bold text-2xl md:text-3xl text-white mb-3">Ready to start collaborating?</h2>
          <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>Commissioner is in early access — be one of the first creators or businesses on the platform.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setPage('creators')} style={{ background: '#E6007A' }} className="text-white font-semibold px-6 py-3 rounded-xl">Hire creators</button>
            <button onClick={() => setPage('onboarding')} style={{ borderColor: '#00D9FF', color: '#00D9FF' }} className="border-2 font-semibold px-6 py-3 rounded-xl">Join as a creator</button>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook'];

function parseFollowers(s) {
  if (!s || s === '—') return 0;
  const n = parseFloat(s);
  return s.toUpperCase().includes('K') ? n * 1000 : s.toUpperCase().includes('M') ? n * 1000000 : n;
}

const FiltersPanel = ({ filters, setFilters, onClose, cities }) => {
  const togglePlatform = (p) => setFilters(f => ({
    ...f,
    platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
  }));
  return (
    <div className="bg-white border rounded-2xl p-5 mb-6" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Filters</p>
        <button onClick={onClose} className="text-xs font-semibold" style={{ color: '#6B7280' }}>Close</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Platform</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border capitalize"
                style={{
                  background: filters.platforms.includes(p) ? '#E0FBFF' : 'white',
                  color: filters.platforms.includes(p) ? '#036377' : '#374151',
                  borderColor: filters.platforms.includes(p) ? '#00D9FF' : '#E5E7EB',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>City</p>
          <select
            value={filters.city}
            onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
            className="w-full border rounded-lg px-2.5 py-2 text-sm outline-none"
            style={{ borderColor: '#E5E7EB' }}
          >
            <option value="All">All cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Min. followers: {filters.minFollowers === 0 ? 'Any' : `${filters.minFollowers / 1000}K+`}</p>
          <input
            type="range" min="0" max="400000" step="10000"
            value={filters.minFollowers}
            onChange={e => setFilters(f => ({ ...f, minFollowers: Number(e.target.value) }))}
            className="w-full"
          />
        </div>
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Max. price: ${filters.maxPrice}</p>
          <input
            type="range" min="50" max="350" step="10"
            value={filters.maxPrice}
            onChange={e => setFilters(f => ({ ...f, maxPrice: Number(e.target.value) }))}
            className="w-full"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 mt-5 text-sm" style={{ color: '#374151' }}>
        <input type="checkbox" checked={filters.verifiedOnly} onChange={e => setFilters(f => ({ ...f, verifiedOnly: e.target.checked }))} />
        Verified only
      </label>
      <button
        onClick={() => setFilters({ platforms: [], city: 'All', minFollowers: 0, maxPrice: 350, verifiedOnly: false })}
        className="text-xs font-semibold mt-4"
        style={{ color: '#E6007A' }}
      >
        Reset all filters
      </button>
    </div>
  );
};

const Creators = ({ session, savedIds, toggleSave, onHire }) => {
  const [allCreators, setAllCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ platforms: [], city: 'All', minFollowers: 0, maxPrice: 350, verifiedOnly: false });

  useEffect(() => {
    fetchLiveCreators().then(list => { setAllCreators(list); setLoading(false); });
  }, []);

  const cities = [...new Set(allCreators.map(c => c.city).filter(Boolean))];

  const filtered = allCreators.filter(c =>
    (niche === 'All' || c.niche === niche) &&
    (query === '' || c.name.toLowerCase().includes(query.toLowerCase()) || c.niche.toLowerCase().includes(query.toLowerCase()) || c.city.toLowerCase().includes(query.toLowerCase())) &&
    (filters.platforms.length === 0 || filters.platforms.some(p => c.platforms.includes(p))) &&
    (filters.city === 'All' || c.city === filters.city) &&
    parseFollowers(c.followers) >= filters.minFollowers &&
    (c.price === null || c.price <= filters.maxPrice) &&
    (!filters.verifiedOnly || c.verified)
  );

  const activeFilterCount = filters.platforms.length + (filters.city !== 'All' ? 1 : 0) + (filters.minFollowers > 0 ? 1 : 0) + (filters.maxPrice < 350 ? 1 : 0) + (filters.verifiedOnly ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <div className="mb-7">
        <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Discover creators</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>{loading ? 'Loading…' : `${filtered.length} creators match your search`}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 flex-1" style={{ borderColor: '#E5E7EB' }}>
          <Search size={16} style={{ color: '#6B7280' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, niche, platform, or city"
            className="flex-1 outline-none text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(s => !s)}
          className="flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ borderColor: showFilters ? '#E6007A' : '#E5E7EB', color: showFilters ? '#E6007A' : '#374151' }}
        >
          <SlidersHorizontal size={15} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && <FiltersPanel filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} cities={cities} />}

      <div className="flex gap-2 overflow-x-auto cm-scroll mb-8 pb-1">
        {['All', ...NICHES].map(n => (
          <button
            key={n}
            onClick={() => setNiche(n)}
            className="shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border"
            style={{
              background: niche === n ? '#E6007A' : 'white',
              color: niche === n ? 'white' : '#374151',
              borderColor: niche === n ? '#E6007A' : '#E5E7EB'
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-center py-16" style={{ color: '#6B7280' }}>Loading creators…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>
            {allCreators.length === 0 ? 'No creators have joined yet' : 'No creators match those filters'}
          </p>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {allCreators.length === 0 ? 'Check back soon, or be the first to join as a creator.' : 'Try widening your search or resetting filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(c => (
            <CreatorCard key={c.id} c={c} saved={savedIds.includes(c.id)} onToggleSave={toggleSave} onHire={onHire} />
          ))}
        </div>
      )}
    </div>
  );
};

const Campaigns = ({ session, setPage, appliedIds, onApply }) => (
  <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Campaigns</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>Open opportunities from verified businesses</p>
      </div>
      <button
        onClick={() => setPage(session ? 'onboarding' : 'auth')}
        style={{ background: '#E6007A' }}
        className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg shrink-0"
      >
        Post a campaign
      </button>
    </div>

    <div className="flex flex-col gap-4">
      {CAMPAIGNS.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={28} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No campaigns posted yet</p>
          <p className="text-xs" style={{ color: '#6B7280' }}>Be the first business to post one, or check back soon.</p>
        </div>
      ) : CAMPAIGNS.map(camp => (
        <div key={camp.id} className="cm-card-hover bg-white border rounded-2xl p-5 md:p-6" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div style={{ background: '#F8FAFC' }} className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                <Building2 size={18} style={{ color: '#6B7280' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-sm" style={{ color: '#111827' }}>{camp.title}</p>
                  <StatusPill status={camp.status} />
                </div>
                <p className="text-xs mb-3" style={{ color: '#6B7280' }}>{camp.business}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: '#6B7280' }}>
                  <span className="flex items-center gap-1"><DollarSign size={12} />{camp.budget}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} />{camp.city}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />Due {camp.deadline}</span>
                  <span className="flex items-center gap-1"><Users size={12} />{camp.creators} creators needed</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pl-16 md:pl-0">
              <span style={{ background: '#FDE7F1', color: '#99154F' }} className="text-[11px] font-semibold px-2.5 py-1 rounded-full">{camp.niche}</span>
              {appliedIds.includes(camp.id) ? (
                <span style={{ background: '#E9FBEF', color: '#0E7A3B' }} className="text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Applied
                </span>
              ) : (
                <button onClick={() => onApply(camp)} style={{ background: '#111827' }} className="text-white text-xs font-semibold px-4 py-2.5 rounded-lg">Apply</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Messages = () => {
  const [active, setActive] = useState(null);
  const activeConvo = CONVERSATIONS.find(c => c.id === active);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-8">
      <h1 className="cm-display font-bold text-2xl md:text-3xl mb-6" style={{ color: '#111827' }}>Messages</h1>
      <div className="bg-white border rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ borderColor: '#E5E7EB', height: '600px' }}>

        {/* conversation list */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <div className="p-3 border-b" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2" style={{ borderColor: '#E5E7EB', background: '#F8FAFC' }}>
              <Search size={14} style={{ color: '#6B7280' }} />
              <input placeholder="Search messages" className="flex-1 outline-none text-xs bg-transparent" />
            </div>
          </div>
          <div className="overflow-y-auto cm-scroll flex-1">
            {CONVERSATIONS.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare size={22} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                <p className="text-xs" style={{ color: '#6B7280' }}>No conversations yet. Messages from creators and businesses you contact will show up here.</p>
              </div>
            ) : CONVERSATIONS.map(c => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: '#F3F4F6', background: active === c.id ? '#FDE7F1' : 'white' }}
              >
                <div className="relative shrink-0">
                  <Avatar name={c.name} size={40} tone={c.tone} />
                  {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: '#0E7A3B' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{c.name}</p>
                    <span className="text-[11px] shrink-0" style={{ color: '#9CA3AF' }}>{c.time}</span>
                  </div>
                  <p className="text-xs truncate" style={{ color: c.unread ? '#111827' : '#6B7280', fontWeight: c.unread ? 600 : 400 }}>{c.preview}</p>
                </div>
                {c.unread > 0 && (
                  <span style={{ background: '#E6007A' }} className="w-4.5 h-4.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" >
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* thread */}
        {!activeConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
            <MessageSquare size={28} style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>No conversation selected</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Message a creator or business from their profile to start a conversation.</p>
          </div>
        ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center gap-3">
              <Avatar name={activeConvo.name} size={36} tone={activeConvo.tone} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#111827' }}>{activeConvo.name}</p>
                <p className="text-[11px]" style={{ color: activeConvo.online ? '#0E7A3B' : '#9CA3AF' }}>{activeConvo.online ? 'Online' : 'Offline'}</p>
              </div>
            </div>
            <button style={{ background: '#E0FBFF', color: '#036377' }} className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Briefcase size={13} /> Campaign workspace
            </button>
          </div>

          <div className="flex-1 overflow-y-auto cm-scroll px-5 py-5 flex flex-col gap-3" style={{ background: '#F8FAFC' }}>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: '#E5E7EB' }}>
            <button style={{ color: '#00A8CC' }}><Paperclip size={18} /></button>
            <button style={{ color: '#00A8CC' }}><Mic size={18} /></button>
            <input placeholder="Write a message" className="flex-1 outline-none text-sm px-2" />
            <button style={{ background: '#E6007A' }} className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0">
              <Send size={15} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
    <div className="flex items-center justify-between mb-4">
      <div style={{ background: '#E0FBFF' }} className="w-9 h-9 rounded-lg flex items-center justify-center">
        <Icon size={16} style={{ color: '#036377' }} />
      </div>
    </div>
    <p className="cm-mono text-xl font-semibold mb-0.5" style={{ color: '#111827' }}>{value}</p>
    <p className="text-xs" style={{ color: '#6B7280' }}>{label}</p>
  </div>
);

const Dashboard = ({ session }) => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('creator_profiles')
      .select('page_name, username, avatar_url, city, language, bio, verified, primary_niche, availability, onboarded, approved')
      .eq('auth_user_id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  const displayName = profile?.page_name || session?.user?.email || 'Your profile';
  const completion = [profile?.page_name, profile?.username, profile?.avatar_url, profile?.city, profile?.bio].filter(Boolean).length * 20;

  return (
  <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <Avatar name={displayName} size={56} tone={0} ring src={profile?.avatar_url} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="cm-display font-bold text-xl" style={{ color: '#111827' }}>{displayName}</h1>
            {profile?.verified && <VerifiedBadge />}
          </div>
          <p className="text-sm" style={{ color: '#6B7280' }}>{profile?.username ? `@${profile.username.replace(/^@/, '')}` : 'Complete your profile'}{profile?.city ? ` · ${profile.city}` : ''}</p>
        </div>
      </div>
      <span style={{ background: '#111827' }} className="text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 w-fit">
        <Zap size={13} style={{ color: '#00D9FF' }} /> Basic plan
      </span>
    </div>

    {profile?.onboarded && (
      <div
        className="flex items-center gap-2 rounded-xl p-4 mb-6 text-sm font-semibold"
        style={profile?.approved
          ? { background: '#E9FBEF', color: '#0E7A3B' }
          : { background: '#FFF1E5', color: '#9A4A0C' }}
      >
        {profile?.approved
          ? <><CheckCircle2 size={16} /> Your profile is approved and visible to businesses.</>
          : <><Clock size={16} /> Your profile is submitted and pending approval — it won't appear in Discover creators until reviewed.</>}
      </div>
    )}

    {/* profile completion + connector to earnings, the beam motif */}
    <div className="bg-white border rounded-2xl p-5 mb-6" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Profile completion</p>
        <p className="cm-mono text-sm font-semibold" style={{ color: '#E6007A' }}>{completion}%</p>
      </div>
      <div className="h-2 rounded-full w-full" style={{ background: '#F3F4F6' }}>
        <div className="h-2 rounded-full cm-beam" style={{ width: `${completion}%` }} />
      </div>
      {completion < 100 && <p className="text-xs mt-2" style={{ color: '#6B7280' }}>Finish your profile to improve your discovery ranking.</p>}
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard icon={Wallet} label="Earnings this month" value="$0" />
      <StatCard icon={MessageSquare} label="Unread messages" value="0" />
      <StatCard icon={Briefcase} label="Campaign invitations" value="0" />
      <StatCard icon={Award} label="Avg. rating" value="Not yet rated" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Campaign invitations</p>
        <div className="text-center py-8">
          <Briefcase size={22} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} />
          <p className="text-xs" style={{ color: '#6B7280' }}>No invitations yet — businesses will reach out here once your profile is complete.</p>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Account status</p>
        <div className="flex flex-col gap-3.5">
          {[
            { icon: UserCheck, l: 'Verification', v: profile?.verified ? 'Approved' : 'Not verified', c: profile?.verified ? '#0E7A3B' : '#9CA3AF' },
            { icon: Zap, l: 'Subscription', v: 'Basic (free)', c: '#111827' },
            { icon: Play, l: 'Spotlight videos', v: '0 / 3 used', c: '#111827' },
            { icon: Shield, l: 'NFC card', v: 'Not ordered', c: '#9CA3AF' },
          ].map(r => (
            <div key={r.l} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                <r.icon size={15} style={{ color: '#00A8CC' }} /> {r.l}
              </span>
              <span className="text-xs font-semibold" style={{ color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

const Spotlight = () => (
  <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
    <div className="mb-8">
      <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Spotlight</h1>
      <p className="text-sm" style={{ color: '#6B7280' }}>Short vertical videos — a free portfolio and advertisement feed for creators.</p>
    </div>

    <div className="flex items-center gap-2 mb-8 overflow-x-auto cm-scroll pb-1">
      {['Trending', 'Verified creators', 'Recommended', 'Featured'].map((t, i) => (
        <button
          key={t}
          className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border"
          style={{
            background: i === 0 ? '#111827' : 'white',
            color: i === 0 ? 'white' : '#374151',
            borderColor: i === 0 ? '#111827' : '#E5E7EB'
          }}
        >
          {i === 0 && <Flame size={12} style={{ color: '#00D9FF' }} />}
          {t}
        </button>
      ))}
    </div>

    {SPOTLIGHT_VIDEOS.length === 0 ? (
      <div className="text-center py-16">
        <Play size={28} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No Spotlight videos yet</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>Creators can upload short vertical videos from their dashboard once that's enabled.</p>
      </div>
    ) : (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {SPOTLIGHT_VIDEOS.map(v => (
        <div key={v.id} className="cm-card-hover rounded-2xl overflow-hidden border cursor-pointer" style={{ borderColor: '#E5E7EB' }}>
          <div
            className="relative flex items-center justify-center"
            style={{ aspectRatio: '9 / 16', background: `linear-gradient(160deg, ${AVATAR_PALETTE[v.tone % 6][0]}, white)` }}
          >
            <div style={{ background: 'rgba(17,24,39,0.55)' }} className="w-11 h-11 rounded-full flex items-center justify-center">
              <Play size={18} fill="white" style={{ color: 'white' }} />
            </div>
            {v.trending && (
              <span style={{ background: '#E6007A' }} className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Flame size={10} /> Trending
              </span>
            )}
            <span style={{ background: 'rgba(17,24,39,0.65)' }} className="absolute bottom-2 right-2 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
              {v.duration}
            </span>
          </div>
          <div className="p-3 bg-white">
            <div className="flex items-center gap-1.5 mb-1">
              <Avatar name={v.creator} size={20} tone={v.tone} />
              <p className="text-xs font-semibold truncate" style={{ color: '#111827' }}>{v.creator}</p>
              {v.verified && <CheckCircle2 size={12} style={{ color: '#00A8CC' }} strokeWidth={2.5} />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#6B7280' }}>{v.niche}</span>
              <span className="cm-mono text-[11px]" style={{ color: '#6B7280' }}>{v.views} views</span>
            </div>
          </div>
        </div>
      ))}
    </div>
    )}
  </div>
);

const PlanCard = ({ plan }) => {
  const toneMap = {
    gray: { bg: '#F8FAFC', fg: '#374151', border: '#E5E7EB' },
    cyan: { bg: '#E0FBFF', fg: '#036377', border: '#00D9FF' },
    magenta: { bg: '#FDE7F1', fg: '#99154F', border: '#E6007A' },
  };
  const t = toneMap[plan.tone];
  return (
    <div
      className="rounded-2xl p-6 bg-white flex flex-col"
      style={{ border: plan.popular ? `2px solid ${t.border}` : '1px solid #E5E7EB' }}
    >
      {plan.popular && (
        <span style={{ background: t.bg, color: t.fg }} className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full mb-4">
          Most popular
        </span>
      )}
      <p className="font-semibold text-base mb-1" style={{ color: '#111827' }}>{plan.name}</p>
      <div className="flex items-baseline gap-1 mb-5">
        <span className="cm-display font-bold text-3xl" style={{ color: '#111827' }}>{plan.price}</span>
        <span className="text-sm" style={{ color: '#6B7280' }}>{plan.period}</span>
      </div>
      <div className="flex flex-col gap-2.5 mb-6 flex-1">
        {plan.features.map(f => (
          <div key={f} className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
            <Check size={14} style={{ color: t.fg }} strokeWidth={2.5} />
            {f}
          </div>
        ))}
      </div>
      <button
        style={{ background: plan.tone === 'magenta' ? '#E6007A' : '#111827' }}
        className="text-white text-sm font-semibold py-2.5 rounded-lg"
      >
        Choose {plan.name}
      </button>
    </div>
  );
};

const Pricing = () => {
  const [audience, setAudience] = useState('creators');
  const plans = audience === 'creators' ? CREATOR_PLANS : BUSINESS_PLANS;
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-14">
      <div className="text-center mb-8">
        <h1 className="cm-display font-bold text-3xl mb-3" style={{ color: '#111827' }}>Simple, transparent pricing</h1>
        <p className="text-sm max-w-lg mx-auto" style={{ color: '#6B7280' }}>Pick the plan that fits where you are today — upgrade any time.</p>
      </div>

      <div className="flex justify-center mb-10">
        <div className="inline-flex bg-white border rounded-xl p-1" style={{ borderColor: '#E5E7EB' }}>
          {['creators', 'businesses'].map(a => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className="px-5 py-2 rounded-lg text-sm font-semibold capitalize"
              style={{ background: audience === a ? '#111827' : 'transparent', color: audience === a ? 'white' : '#374151' }}
            >
              For {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(p => <PlanCard key={p.id} plan={p} />)}
      </div>
    </div>
  );
};

const OnboardingField = ({ label, placeholder, icon: Icon, value, onChange, type = 'text' }) => (
  <div>
    <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>{label}</label>
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5" style={{ borderColor: '#E5E7EB' }}>
      {Icon && <Icon size={15} style={{ color: '#6B7280' }} />}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="flex-1 outline-none text-sm" />
    </div>
  </div>
);

const PLATFORM_LIST = [
  { p: 'TikTok', icon: null },
  { p: 'Instagram', icon: Instagram },
  { p: 'YouTube', icon: Youtube },
  { p: 'Facebook', icon: Facebook },
  { p: 'Telegram', icon: null },
];

const ImageUploadTile = ({ label, shape, previewUrl, onFile, uploading }) => {
  const inputRef = React.useRef(null);
  const isCircle = shape === 'circle';
  return (
    <div>
      <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`flex items-center justify-center border-2 border-dashed cursor-pointer overflow-hidden ${isCircle ? 'w-14 h-14 rounded-full' : 'h-14 rounded-lg'}`}
        style={{ borderColor: '#E5E7EB', background: '#F8FAFC' }}
      >
        {uploading ? (
          <span className="text-[11px]" style={{ color: '#6B7280' }}>Uploading…</span>
        ) : previewUrl ? (
          <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
        ) : isCircle ? (
          <Camera size={18} style={{ color: '#6B7280' }} />
        ) : (
          <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#374151' }}><ImagePlus size={15} /> Upload {label.split(' ')[0].toLowerCase()}</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
    </div>
  );
};

const Onboarding = ({ session, setPage }) => {
  const [step, setStep] = useState(0);

  // Basic info
  const [pageName, setPageName] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const handleAvatarFile = (file) => { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); };
  const handleBannerFile = (file) => { setBannerFile(file); setBannerPreview(URL.createObjectURL(file)); };

  const uploadImage = async (file, bucket) => {
    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/${bucket}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  // Social media
  const [socials, setSocials] = useState({}); // { TikTok: { handle, followers, engagement }, ... }
  const updateSocial = (platform, field, value) => {
    setSocials(s => ({ ...s, [platform]: { ...s[platform], [field]: value } }));
  };

  // Niche (optional)
  const [primaryNiche, setPrimaryNiche] = useState('');
  const [secondary, setSecondary] = useState([]);
  const toggleSecondary = (n) => {
    if (secondary.includes(n)) setSecondary(secondary.filter(s => s !== n));
    else if (secondary.length < 3) setSecondary([...secondary, n]);
  };

  // Audience & metrics
  const [audienceAge, setAudienceAge] = useState('');
  const [audienceGender, setAudienceGender] = useState('');
  const [audienceLocation, setAudienceLocation] = useState('');
  const [avgViews, setAvgViews] = useState('');
  const [avgReach, setAvgReach] = useState('');

  // Services & pricing
  const [pricing, setPricing] = useState({ tiktok: '', reel: '', story: '', youtube: '', monthly: '', ugc: '' });

  // Portfolio (optional)
  const [portfolioLink, setPortfolioLink] = useState('');

  // Availability & preferences
  const [availability, setAvailability] = useState('Available now');
  const [preferences, setPreferences] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const finishSetup = async () => {
    if (!session) { setPage('auth'); return; }
    setSaving(true);
    setSaveError('');
    try {
      let avatarUrl, bannerUrl;
      if (avatarFile) { setUploadingAvatar(true); avatarUrl = await uploadImage(avatarFile, 'avatars'); setUploadingAvatar(false); }
      if (bannerFile) { setUploadingBanner(true); bannerUrl = await uploadImage(bannerFile, 'banners'); setUploadingBanner(false); }
      const { error } = await supabase
        .from('creator_profiles')
        .update({
          page_name: pageName,
          username,
          city: location,
          language,
          bio,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(bannerUrl ? { banner_url: bannerUrl } : {}),
          primary_niche: primaryNiche || null,
          secondary_niches: secondary,
          platforms: socials,
          audience: { age: audienceAge, gender: audienceGender, location: audienceLocation, avg_views: avgViews, avg_reach: avgReach },
          services: pricing,
          portfolio_link: portfolioLink,
          availability,
          professional_preferences: preferences,
          onboarded: true,
        })
        .eq('auth_user_id', session.user.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setPage('dashboard'), 1200);
    } catch (err) {
      setSaveError(err.message || 'Something went wrong saving your profile.');
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
      setUploadingBanner(false);
    }
  };

  if (saved) {
    return (
      <div className="max-w-2xl mx-auto px-5 md:px-8 py-24 text-center">
        <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#0E7A3B' }} />
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Profile submitted — it's now pending approval. Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="cm-display font-bold text-2xl mb-2" style={{ color: '#111827' }}>Set up your creator profile</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>Step {step + 1} of {ONBOARDING_STEPS.length} — {ONBOARDING_STEPS[step]}</p>
      </div>

      <div className="flex items-center gap-1.5 mb-10">
        {ONBOARDING_STEPS.map((s, i) => (
          <div key={s} className="flex-1 h-1.5 rounded-full" style={{ background: i <= step ? undefined : '#F3F4F6' }}>
            {i <= step && <div className="h-1.5 rounded-full cm-beam" />}
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-2xl p-6 md:p-8" style={{ borderColor: '#E5E7EB' }}>
        {/* Step 0 — Basic info */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <OnboardingField label="Page name" placeholder="e.g. Amara Eats" value={pageName} onChange={e => setPageName(e.target.value)} />
            <OnboardingField label="Creator username" placeholder="e.g. @amara.eats" value={username} onChange={e => setUsername(e.target.value)} />

            <div className="grid grid-cols-2 gap-4">
              <ImageUploadTile label="Profile photo" shape="circle" previewUrl={avatarPreview} onFile={handleAvatarFile} uploading={uploadingAvatar} />
              <ImageUploadTile label="Cover / banner image" shape="banner" previewUrl={bannerPreview} onFile={handleBannerFile} uploading={uploadingBanner} />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Short bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell businesses what you create and who you create it for" rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <OnboardingField label="Location" placeholder="e.g. Addis Ababa, Ethiopia" icon={MapPin} value={location} onChange={e => setLocation(e.target.value)} />
              <OnboardingField label="Language" placeholder="e.g. Amharic, English" icon={Languages} value={language} onChange={e => setLanguage(e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 1 — Social media */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Which platforms are you on? <span style={{ color: '#6B7280', fontWeight: 400 }}>— add your handle, followers, and engagement rate</span></p>
            {PLATFORM_LIST.map(row => (
              <div key={row.p} className="flex items-center gap-3 border rounded-xl p-3.5" style={{ borderColor: '#E5E7EB' }}>
                <div style={{ background: '#E0FBFF' }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                  {row.icon ? <row.icon size={16} style={{ color: '#036377' }} /> : <span className="cm-display font-bold" style={{ color: '#036377' }}>♪</span>}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input
                    placeholder="@username"
                    value={socials[row.p]?.handle || ''}
                    onChange={e => updateSocial(row.p, 'handle', e.target.value)}
                    className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }}
                  />
                  <input
                    placeholder="Followers"
                    value={socials[row.p]?.followers || ''}
                    onChange={e => updateSocial(row.p, 'followers', e.target.value)}
                    className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }}
                  />
                  <input
                    placeholder="Engagement %"
                    value={socials[row.p]?.engagement || ''}
                    onChange={e => updateSocial(row.p, 'engagement', e.target.value)}
                    className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2 — Niche (optional) */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <p className="text-xs" style={{ color: '#6B7280' }}>Optional — skip this if you'd rather not specify a niche.</p>
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Primary niche <span style={{ color: '#6B7280', fontWeight: 400 }}>— choose one</span></p>
              <div className="flex flex-wrap gap-2">
                {NICHES.map(n => (
                  <button
                    key={n}
                    onClick={() => setPrimaryNiche(primaryNiche === n ? '' : n)}
                    className="text-xs font-semibold px-3.5 py-2 rounded-full border"
                    style={{
                      background: primaryNiche === n ? '#E6007A' : 'white',
                      color: primaryNiche === n ? 'white' : '#374151',
                      borderColor: primaryNiche === n ? '#E6007A' : '#E5E7EB'
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Secondary niches <span style={{ color: '#6B7280', fontWeight: 400 }}>— up to three ({secondary.length}/3)</span></p>
              <div className="flex flex-wrap gap-2">
                {NICHES.filter(n => n !== primaryNiche).map(n => (
                  <button
                    key={n}
                    onClick={() => toggleSecondary(n)}
                    className="text-xs font-semibold px-3.5 py-2 rounded-full border flex items-center gap-1"
                    style={{
                      background: secondary.includes(n) ? '#E0FBFF' : 'white',
                      color: secondary.includes(n) ? '#036377' : '#374151',
                      borderColor: secondary.includes(n) ? '#00D9FF' : '#E5E7EB'
                    }}
                  >
                    {secondary.includes(n) && <Check size={11} strokeWidth={3} />}
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Audience & creator metrics */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Audience info</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Audience age range</label>
                <select value={audienceAge} onChange={e => setAudienceAge(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }}>
                  <option value="">Select…</option>
                  <option>13–17</option><option>18–24</option><option>25–34</option><option>35–44</option><option>45+</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Audience gender</label>
                <select value={audienceGender} onChange={e => setAudienceGender(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }}>
                  <option value="">Select…</option>
                  <option>Mostly male</option><option>Mostly female</option><option>Balanced</option>
                </select>
              </div>
            </div>
            <OnboardingField label="Audience location" placeholder="e.g. Ethiopia, East Africa" icon={MapPin} value={audienceLocation} onChange={e => setAudienceLocation(e.target.value)} />
            <p className="text-sm font-semibold mt-2" style={{ color: '#111827' }}>Creator metrics</p>
            <div className="grid grid-cols-2 gap-4">
              <OnboardingField label="Avg. views (last 10 videos)" placeholder="e.g. 25000" type="number" value={avgViews} onChange={e => setAvgViews(e.target.value)} />
              <OnboardingField label="Average reach" placeholder="e.g. 40000" type="number" value={avgReach} onChange={e => setAvgReach(e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 4 — Services & pricing */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Services offered & pricing</p>
            <div className="grid grid-cols-2 gap-4">
              <OnboardingField label="TikTok video" placeholder="$" value={pricing.tiktok} onChange={e => setPricing(p => ({ ...p, tiktok: e.target.value }))} />
              <OnboardingField label="Instagram Reel" placeholder="$" value={pricing.reel} onChange={e => setPricing(p => ({ ...p, reel: e.target.value }))} />
              <OnboardingField label="Story" placeholder="$" value={pricing.story} onChange={e => setPricing(p => ({ ...p, story: e.target.value }))} />
              <OnboardingField label="YouTube video" placeholder="$" value={pricing.youtube} onChange={e => setPricing(p => ({ ...p, youtube: e.target.value }))} />
              <OnboardingField label="Monthly collaboration" placeholder="$" value={pricing.monthly} onChange={e => setPricing(p => ({ ...p, monthly: e.target.value }))} />
              <OnboardingField label="UGC content" placeholder="$" value={pricing.ugc} onChange={e => setPricing(p => ({ ...p, ugc: e.target.value }))} />
            </div>
          </div>
        )}

        {/* Step 5 — Portfolio (optional) */}
        {step === 5 && (
          <div className="flex flex-col gap-5">
            <p className="text-xs" style={{ color: '#6B7280' }}>Optional — you can add this later.</p>
            <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: '#E5E7EB' }}>
              <Upload size={22} className="mx-auto mb-2" style={{ color: '#6B7280' }} />
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>Upload videos and images</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Showcase past collaborations and your best work</p>
            </div>
            <OnboardingField label="Portfolio link" placeholder="https://" icon={Link2} value={portfolioLink} onChange={e => setPortfolioLink(e.target.value)} />
          </div>
        )}

        {/* Step 6 — Availability & preferences */}
        {step === 6 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Availability</label>
              <select value={availability} onChange={e => setAvailability(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }}>
                <option>Available now</option>
                <option>Limited availability</option>
                <option>Not currently available</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Professional preferences</label>
              <textarea value={preferences} onChange={e => setPreferences(e.target.value)} placeholder="e.g. preferred collaboration types, minimum budget, industries you'd rather not work with" rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg border"
          style={{ borderColor: '#E5E7EB', color: step === 0 ? '#D1D5DB' : '#374151' }}
        >
          <ChevronLeft size={15} /> Back
        </button>
        <button
          onClick={() => {
            if (step === ONBOARDING_STEPS.length - 1) finishSetup();
            else setStep(Math.min(ONBOARDING_STEPS.length - 1, step + 1));
          }}
          disabled={saving}
          style={{ background: '#E6007A' }}
          className="flex items-center gap-1.5 text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-50"
        >
          {saving ? (uploadingAvatar || uploadingBanner ? 'Uploading…' : 'Saving…') : step === ONBOARDING_STEPS.length - 1 ? 'Finish setup' : 'Continue'} <ArrowRight size={15} />
        </button>
      </div>
      {saveError && <p className="text-xs mt-3 text-center" style={{ color: '#DC2626' }}>{saveError}</p>}
    </div>
  );
};

/* ---------------------------------- app ---------------------------------- */

const AccountSettings = ({ session, setPage }) => {
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError(''); setPwMessage('');
    if (newPassword.length < 8) { setPwError('Password should be at least 8 characters.'); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) { setPwError(error.message); return; }
    setPwMessage('Password updated.');
    setNewPassword('');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPage('home');
  };

  const handleSignOutAll = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setPage('home');
  };

  return (
    <div className="max-w-xl mx-auto px-5 md:px-8 py-12">
      <h1 className="cm-display font-bold text-2xl mb-8" style={{ color: '#111827' }}>Account settings</h1>

      <div className="bg-white border rounded-2xl p-6 mb-6" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>Signed in as</p>
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{session.user.email}</p>
      </div>

      <div className="bg-white border rounded-2xl p-6 mb-6" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Creator profile</p>
          <button onClick={() => setPage('onboarding')} className="text-xs font-semibold" style={{ color: '#036377' }}>Edit profile</button>
        </div>
      </div>

      <form onSubmit={handlePasswordChange} className="bg-white border rounded-2xl p-6 mb-6" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Change password</p>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5 mb-3" style={{ borderColor: '#E5E7EB' }}>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="flex-1 outline-none text-sm" />
        </div>
        <button type="submit" disabled={pwSaving} style={{ background: '#111827' }} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50">
          {pwSaving ? 'Saving…' : 'Update password'}
        </button>
        {pwMessage && <p className="text-xs mt-3" style={{ color: '#0E7A3B' }}>{pwMessage}</p>}
        {pwError && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{pwError}</p>}
      </form>

      <div className="bg-white border rounded-2xl p-6" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Session</p>
        <div className="flex flex-col gap-3">
          <button onClick={handleSignOut} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border self-start" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
            <LogOut size={15} /> Sign out
          </button>
          <button onClick={handleSignOutAll} className="text-xs font-medium self-start" style={{ color: '#6B7280' }}>
            Sign out of all devices
          </button>
        </div>
      </div>
    </div>
  );
};

const ClaimProfile = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageName, setPageName] = useState('');
  const [primaryNiche, setPrimaryNiche] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [socials, setSocials] = useState({});
  const updateSocial = (platform, field, value) => setSocials(s => ({ ...s, [platform]: { ...s[platform], [field]: value } }));
  const [portfolioLink, setPortfolioLink] = useState('');
  const [availability, setAvailability] = useState('Available now');
  const [preferences, setPreferences] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.rpc('get_claim_profile', { p_token: token }).then(({ data, error }) => {
      if (error || !data || data.length === 0) { setNotFound(true); setLoading(false); return; }
      const row = data[0];
      setPageName(row.page_name || '');
      setPrimaryNiche(row.primary_niche || '');
      setUsername(row.username || '');
      setCity(row.city || '');
      setLanguage(row.language || '');
      setBio(row.bio || '');
      setAvatarPreview(row.avatar_url || '');
      setBannerPreview(row.banner_url || '');
      setSocials(row.platforms || {});
      setPortfolioLink(row.portfolio_link || '');
      setAvailability(row.availability || 'Available now');
      setPreferences(row.professional_preferences || '');
      setLoading(false);
    });
  }, [token]);

  const handleAvatarFile = (file) => { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); };
  const handleBannerFile = (file) => { setBannerFile(file); setBannerPreview(URL.createObjectURL(file)); };

  const uploadImage = async (file, bucket) => {
    const ext = file.name.split('.').pop();
    const path = `claim/${token}/${bucket}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError('');
    try {
      let avatarUrl, bannerUrl;
      if (avatarFile) { setUploadingAvatar(true); avatarUrl = await uploadImage(avatarFile, 'avatars'); setUploadingAvatar(false); }
      if (bannerFile) { setUploadingBanner(true); bannerUrl = await uploadImage(bannerFile, 'banners'); setUploadingBanner(false); }
      const { data, error } = await supabase.rpc('claim_profile', {
        p_token: token,
        p_page_name: pageName,
        p_username: username,
        p_city: city,
        p_language: language,
        p_bio: bio,
        p_avatar_url: avatarUrl || avatarPreview || null,
        p_banner_url: bannerUrl || bannerPreview || null,
        p_platforms: socials,
        p_portfolio_link: portfolioLink,
        p_availability: availability,
        p_preferences: preferences,
      });
      if (error) throw error;
      if (!data) { setNotFound(true); return; }
      setSaved(true);
    } catch (err) {
      setSaveError(err.message || 'Something went wrong saving your profile.');
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
      setUploadingBanner(false);
    }
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto px-5 md:px-8 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading your profile…</div>;
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center">
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>This link isn't available</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>It may have already been finished and approved, or the link is incorrect.</p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center">
        <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#0E7A3B' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Profile saved</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>It's pending approval — bookmark this link if you'd like to come back and make changes before then.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="cm-display font-bold text-2xl mb-2" style={{ color: '#111827' }}>Finish your Commissioner profile</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>{pageName ? `You're setting up the profile for ${pageName}.` : "You're setting up your creator profile."} No account needed — just fill this in and submit.</p>
      </div>

      <div className="bg-white border rounded-2xl p-6 md:p-8 flex flex-col gap-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="grid grid-cols-2 gap-4">
          <ImageUploadTile label="Profile photo" shape="circle" previewUrl={avatarPreview} onFile={handleAvatarFile} uploading={uploadingAvatar} />
          <ImageUploadTile label="Cover / banner image" shape="banner" previewUrl={bannerPreview} onFile={handleBannerFile} uploading={uploadingBanner} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <OnboardingField label="Page name" placeholder="e.g. Amara Eats" value={pageName} onChange={e => setPageName(e.target.value)} />
          <OnboardingField label="Username" placeholder="e.g. amara.eats" icon={AtSign} value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <OnboardingField label="City" placeholder="e.g. Addis Ababa" icon={MapPin} value={city} onChange={e => setCity(e.target.value)} />
          <OnboardingField label="Language" placeholder="e.g. Amharic, English" icon={Languages} value={language} onChange={e => setLanguage(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell businesses what you create and who you create it for" rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
        </div>

        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Social accounts</p>
          <div className="flex flex-col gap-3">
            {['TikTok', 'Instagram', 'YouTube', 'Facebook'].map(p => (
              <div key={p} className="border rounded-xl p-3.5" style={{ borderColor: '#E5E7EB' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>{p}</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={socials[p]?.handle || ''} onChange={e => updateSocial(p, 'handle', e.target.value)} placeholder="@username" className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }} />
                  <input value={socials[p]?.followers || ''} onChange={e => updateSocial(p, 'followers', e.target.value)} placeholder="Followers" className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }} />
                  <input value={socials[p]?.engagement || ''} onChange={e => updateSocial(p, 'engagement', e.target.value)} placeholder="Engagement %" className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <OnboardingField label="Portfolio link" placeholder="https://" icon={Link2} value={portfolioLink} onChange={e => setPortfolioLink(e.target.value)} />
        <OnboardingField label="Availability" placeholder="e.g. Available now" icon={Calendar} value={availability} onChange={e => setAvailability(e.target.value)} />
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Anything else businesses should know? <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
          <textarea value={preferences} onChange={e => setPreferences(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ background: '#E6007A' }}
          className="text-white text-sm font-semibold px-5 py-3 rounded-lg disabled:opacity-50 self-start flex items-center gap-1.5"
        >
          {saving ? (uploadingAvatar || uploadingBanner ? 'Uploading…' : 'Saving…') : 'Submit profile'} <ArrowRight size={15} />
        </button>
        {saveError && <p className="text-xs" style={{ color: '#DC2626' }}>{saveError}</p>}
      </div>
    </div>
  );
};

export default function Commissioner() {
  const [page, setPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [appliedIds, setAppliedIds] = useState([]);
  const [toast, setToast] = useState('');
  const [claimToken] = useState(() => new URLSearchParams(window.location.search).get('claim'));

  const toggleSave = (id) => setSavedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const onHire = (creator) => {
    if (!session) { setPage('auth'); return; }
    setToast(`Message sent to ${creator.name} — they typically respond in ${creator.response}.`);
    setTimeout(() => setToast(''), 3000);
  };
  const onApply = (campaign) => {
    if (!session) { setPage('auth'); return; }
    setAppliedIds(a => [...a, campaign.id]);
    setToast(`Application sent for "${campaign.title}".`);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) setPage(p => (p === 'auth' ? 'dashboard' : p));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (claimToken) {
    return (
      <div className="cm-root min-h-screen" style={{ background: '#F8FAFC' }}>
        <FontLoader />
        <ClaimProfile token={claimToken} />
      </div>
    );
  }

  return (
    <div className="cm-root min-h-screen" style={{ background: '#F8FAFC' }}>
      <FontLoader />
      <NavBar page={page} setPage={p => { setPage(p); setMenuOpen(false); }} menuOpen={menuOpen} setMenuOpen={setMenuOpen} session={session} />
      {page === 'home' && <Home setPage={setPage} />}
      {page === 'creators' && <Creators session={session} savedIds={savedIds} toggleSave={toggleSave} onHire={onHire} />}
      {page === 'campaigns' && <Campaigns session={session} setPage={setPage} appliedIds={appliedIds} onApply={onApply} />}
      {page === 'spotlight' && <Spotlight />}
      {page === 'messages' && <Messages />}
      {page === 'pricing' && <Pricing />}
      {page === 'dashboard' && <Dashboard session={session} />}
      {page === 'onboarding' && <Onboarding session={session} setPage={setPage} />}
      {page === 'account' && (session ? <AccountSettings session={session} setPage={setPage} /> : <Auth onAuthenticated={() => setPage('account')} />)}
      {page === 'auth' && (
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
          <Auth onAuthenticated={() => setPage('dashboard')} />
        </div>
      )}
      {page !== 'messages' && page !== 'onboarding' && page !== 'auth' && page !== 'account' && <Footer setPage={setPage} />}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border rounded-xl px-5 py-3 shadow-lg text-sm font-medium" style={{ borderColor: '#E5E7EB', color: '#111827' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
