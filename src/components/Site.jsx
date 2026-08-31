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
  LogOut, Settings, ImagePlus, AtSign, ShoppingBag, Lock, Mail, HelpCircle, Heart, Flag, UserX
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, CartesianGrid
} from 'recharts';

// Admin status is now determined server-side by the public.is_admin() RPC
// (see ADMIN-ROLE-MIGRATION.sql), backed by a real admin_users table instead
// of a hardcoded email allowlist. NavBar and AdminPanel each call it directly.

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
    .select('id, auth_user_id, page_name, username, avatar_url, city, primary_niche, platforms, services, verified')
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
      authUserId: row.auth_user_id,
      tone: i,
      avatarUrl: row.avatar_url,
    };
  });
}

const NICHES = ['Food & Restaurants', 'Fashion', 'Beauty', 'Technology', 'Gaming', 'Fitness', 'Travel', 'Comedy', 'Entertainment'];
const BUSINESS_CATEGORIES = ['Food & Restaurants', 'Fashion & Retail', 'Beauty & Cosmetics', 'Technology', 'Gaming', 'Fitness & Wellness', 'Travel & Hospitality', 'Entertainment', 'Other'];
const LOOKING_FOR_OPTIONS = ['Sponsored posts', 'Product reviews', 'Long-term ambassadorship', 'Event coverage', 'UGC content', 'Affiliate partnerships'];

const CREATOR_PLANS = [
  { id: 'basic', name: 'Basic', price: 'ETB 1', period: '/month', features: ['Profile', 'Portfolio', 'Social links', '3 Spotlight videos'], tone: 'gray' },
  { id: 'pro', name: 'Pro', price: 'ETB 10', period: '/month', features: ['Priority listing', 'Analytics', 'QR card', '20 Spotlight videos'], tone: 'cyan', popular: true },
  { id: 'elite', name: 'Elite NFC', price: 'ETB 20', period: '/month', features: ['NFC card', 'Premium badge', 'Unlimited videos', 'Top placement'], tone: 'magenta' },
];

const BUSINESS_PLANS = [
  { id: 'starter', name: 'Starter', price: 'ETB 5', period: '/month', features: ['Profile', 'Campaign posting'], tone: 'gray' },
  { id: 'growth', name: 'Growth', price: 'ETB 20', period: '/month', features: ['Unlimited campaigns', 'Advanced filters', 'Analytics', 'QR card'], tone: 'cyan', popular: true },
  { id: 'enterprise', name: 'Enterprise NFC', price: 'ETB 50', period: '/month', features: ['NFC business card', 'Premium placement', 'Multiple team members'], tone: 'magenta' },
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

const VerifiedIcon = ({ size = 14, label = 'Verified by Commissioner' }) => (
  <span
    role="img"
    aria-label={label}
    title={label}
    style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: '50%',
      background: '#0095F6',
      color: '#FFFFFF',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle',
      boxShadow: '0 0 0 1px rgba(0,149,246,0.08)',
    }}
  >
    <Check size={size * 0.62} strokeWidth={3.2} />
  </span>
);

const VerifiedBadge = ({ label = 'Verified by Commissioner' }) => (
  <span
    title={label}
    style={{ background: '#E0FBFF', color: '#036377' }}
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
  >
    <VerifiedIcon size={12} label={label} />
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
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session?.user?.id]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [joinMenuOpen, setJoinMenuOpen] = useState(false);
  const isBusiness = session?.user?.user_metadata?.role === 'business';
  const links = [
    { id: 'home', label: 'Home' },
    { id: 'creators', label: 'Creators' },
    { id: 'businesses', label: 'Businesses' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'network', label: 'B2B network' },
    { id: 'trust', label: 'Trust' },
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
                  {isAdmin && (
                    <button onClick={() => { setPage('admin'); setAccountMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#111827' }}>Admin</button>
                  )}
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
          {session ? (
            <button
              onClick={() => setPage('onboarding')}
              style={{ borderColor: '#00D9FF', color: '#036377' }}
              className="border-2 text-sm font-semibold px-3.5 py-1.5 rounded-lg"
            >
              {isBusiness ? 'Edit business profile' : 'Edit creator profile'}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setJoinMenuOpen(o => !o)}
                style={{ borderColor: '#00D9FF', color: '#036377' }}
                className="border-2 text-sm font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                Join Commissioner <ChevronDown size={14} />
              </button>
              {joinMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-xl shadow-lg py-1.5 z-50" style={{ borderColor: '#E5E7EB' }}>
                  <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'creator'); setPage('auth'); setJoinMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#111827' }}>Join as a creator</button>
                  <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'business'); setPage('auth'); setJoinMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50" style={{ color: '#111827' }}>Join as a business</button>
                </div>
              )}
            </div>
          )}
        </div>

        <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
          />
          <aside
            className="lg:hidden fixed top-0 right-0 z-50 h-screen w-[min(88vw,360px)] bg-white shadow-2xl border-l flex flex-col"
            style={{ borderColor: '#E5E7EB' }}
          >
            <div className="h-16 px-5 flex items-center justify-between border-b shrink-0" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg cm-beam flex items-center justify-center">
                  <span className="cm-display text-white font-bold text-sm">C</span>
                </div>
                <span className="cm-display font-bold text-lg" style={{ color: '#111827' }}>Commissioner</span>
              </div>
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-50">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto cm-scroll p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider px-3 mb-2" style={{ color: '#9CA3AF' }}>Navigation</p>
              <div className="flex flex-col gap-1">
                {links.map(l => (
                  <button
                    key={l.id}
                    onClick={() => { setPage(l.id); setMenuOpen(false); }}
                    className="text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between"
                    style={{ color: page === l.id ? '#E6007A' : '#374151', background: page === l.id ? '#FDE7F1' : 'transparent' }}
                  >
                    {l.label}<ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <div className="h-px my-4" style={{ background: '#E5E7EB' }} />
              <p className="text-[10px] font-bold uppercase tracking-wider px-3 mb-2" style={{ color: '#9CA3AF' }}>Account</p>
              {session ? (
                <div className="flex flex-col gap-1">
                  <div className="px-3 py-2 text-xs truncate" style={{ color: '#6B7280' }}>{session.user.email}</div>
                  <button onClick={() => { setPage('dashboard'); setMenuOpen(false); }} className="text-left px-3 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50">Dashboard</button>
                  <button onClick={() => { setPage('account'); setMenuOpen(false); }} className="text-left px-3 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50">Account settings</button>
                  {isAdmin && (
                    <button onClick={() => { setPage('admin'); setMenuOpen(false); }} className="text-left px-3 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50">Admin</button>
                  )}
                  <button onClick={async () => { await supabase.auth.signOut(); setMenuOpen(false); }} className="text-left px-3 py-3 rounded-xl text-sm font-semibold" style={{ color: '#DC2626' }}>Sign out</button>
                </div>
              ) : (
                <button onClick={() => { setPage('auth'); setMenuOpen(false); }} className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold" style={{ color: '#E6007A', background: '#FDE7F1' }}>Sign in</button>
              )}
            </div>
            <div className="p-4 border-t shrink-0 flex flex-col gap-2" style={{ borderColor: '#E5E7EB' }}>
              {session ? (
                <button onClick={() => { setPage('onboarding'); setMenuOpen(false); }} style={{ background: '#E6007A' }} className="w-full text-white text-sm font-semibold px-4 py-3 rounded-xl">
                  {isBusiness ? 'Edit business profile' : 'Edit creator profile'}
                </button>
              ) : (
                <>
                  <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'creator'); setPage('auth'); setMenuOpen(false); }} style={{ background: '#E6007A' }} className="w-full text-white text-sm font-semibold px-4 py-3 rounded-xl">
                    Join as a creator
                  </button>
                  <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'business'); setPage('auth'); setMenuOpen(false); }} style={{ borderColor: '#00D9FF', color: '#036377' }} className="w-full border-2 text-sm font-semibold px-4 py-3 rounded-xl">
                    Join as a business
                  </button>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </header>
  );
};

const FOOTER_LINK_PAGES = {
  'Discover creators': 'creators',
  'Discover businesses': 'businesses',
  'Campaigns': 'campaigns',
  'Spotlight': 'spotlight',
  'About': 'about',
  'Contact': 'about',
  'Pricing': 'pricing',
  'Trust & safety': 'trust',
  'Terms of Service': 'terms',
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
        <p className="text-sm max-w-xs mb-4" style={{ color: '#9CA3AF' }}>Where creators and businesses connect professionally.</p>
        <div className="flex items-center gap-3">
          <a
            href="https://www.facebook.com/profile.php?id=61593362057721"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Commissioner on Facebook"
            className="w-8 h-8 rounded-lg flex items-center justify-center border hover:opacity-80"
            style={{ borderColor: '#1F2937' }}
          >
            <Facebook size={14} style={{ color: '#9CA3AF' }} />
          </a>
          <a
            href="https://www.instagram.com/commissioner.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Commissioner on Instagram"
            className="w-8 h-8 rounded-lg flex items-center justify-center border hover:opacity-80"
            style={{ borderColor: '#1F2937' }}
          >
            <Instagram size={14} style={{ color: '#9CA3AF' }} />
          </a>
        </div>
      </div>
      {[
        { h: 'Platform', items: ['Discover creators', 'Discover businesses', 'Campaigns', 'Spotlight'] },
        { h: 'Company', items: ['About', 'Contact', 'Pricing', 'Trust & safety', 'Terms of Service'] },
        { h: 'Resources', items: ['Help center', 'NFC & QR cards', 'API status', 'Community'] },
      ].map(col => (
        <div key={col.h}>
          <p className="text-sm font-semibold mb-4">{col.h}</p>
          <ul className="space-y-2.5">
            {col.items.map(i => (
              <li key={i}>
                {FOOTER_LINK_PAGES[i] ? (
                  <button
                    onClick={() => setPage(FOOTER_LINK_PAGES[i])}
                    className="text-sm text-left hover:text-white transition-colors"
                    style={{ color: '#9CA3AF' }}
                  >
                    {i}
                  </button>
                ) : (
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>{i}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t px-5 md:px-8 py-6 flex flex-col md:flex-row justify-between gap-3" style={{ borderColor: '#1F2937' }}>
      <p className="text-xs" style={{ color: '#6B7280' }}>© 2026 Commissioner. All rights reserved.</p>
      <p className="text-xs" style={{ color: '#6B7280' }}>Profiles and messaging are powered by Supabase.</p>
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
            {c.verified && <VerifiedIcon size={14} />}
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
        <p className="cm-mono text-base font-semibold" style={{ color: '#111827' }}>{c.price ? `${Number(c.price).toLocaleString()} ETB` : 'Rate on request'}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Starting price</p>
      </div>
      <button onClick={() => onHire(c)} style={{ background: '#E6007A' }} className="text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90">
        Message
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
          Where creators and businesses build real partnerships.
        </h1>
        <p className="text-lg mb-8 max-w-xl" style={{ color: '#374151' }}>
          Commissioner connects vetted creators with businesses for campaigns, UGC, and brand partnerships — whether you're looking to hire or looking for your next deal.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          <button onClick={() => setPage('creators')} style={{ background: '#E6007A' }} className="text-white font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 flex items-center justify-center gap-2">
            Hire creators <ArrowRight size={16} />
          </button>
          <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'creator'); setPage('onboarding'); }} style={{ borderColor: '#00D9FF', color: '#036377' }} className="border-2 font-semibold px-6 py-3.5 rounded-xl hover:bg-cyan-50">
            Join as a creator
          </button>
          <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'business'); setPage('onboarding'); }} style={{ borderColor: '#7C3AED', color: '#7C3AED' }} className="border-2 font-semibold px-6 py-3.5 rounded-xl hover:bg-purple-50">
            Join as a business
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
            { icon: Shield, t: 'Get results', d: 'Track delivery, collaboration history, and verified facts so every relationship builds trust for the next one.' },
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
            <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'creator'); setPage('onboarding'); }} style={{ borderColor: '#00D9FF', color: '#00D9FF' }} className="border-2 font-semibold px-6 py-3 rounded-xl">Join as a creator</button>
            <button onClick={() => { sessionStorage.setItem('commissioner_intended_role', 'business'); setPage('onboarding'); }} style={{ borderColor: '#7C3AED', color: '#A78BFA' }} className="border-2 font-semibold px-6 py-3 rounded-xl">Join as a business</button>
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
          <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Max. price: {filters.maxPrice} ETB</p>
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

const Messages = ({ session, initialRecipientId = null }) => {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);

  const loadConversations = async () => {
    if (!session?.user?.id) { setConversations([]); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('list_my_conversations');
    if (rpcError) {
      setError(rpcError.message || 'Could not load your messages.');
      setConversations([]);
    } else {
      setConversations(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  const loadThread = async (conversationId) => {
    if (!conversationId) return;
    setThreadLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('get_conversation_messages', { p_conversation_id: conversationId });
    if (rpcError) setError(rpcError.message || 'Could not load this conversation.');
    else setMessages(Array.isArray(data) ? data : []);
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c));
    setThreadLoading(false);
  };

  useEffect(() => { loadConversations(); }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const channel = supabase
      .channel(`messages:${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const row = payload.new;
        await loadConversations();
        if (active === row.conversation_id) await loadThread(row.conversation_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, active]);

  useEffect(() => {
    if (!initialRecipientId || !session?.user?.id || initialRecipientId === session.user.id) return;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('start_conversation', {
        p_other_user_id: initialRecipientId,
        p_initial_message: null,
      });
      if (rpcError) { setError(rpcError.message || 'Could not start the conversation.'); return; }
      await loadConversations();
      setActive(data);
      await loadThread(data);
    })();
  }, [initialRecipientId, session?.user?.id]);

  const selectConversation = async (id) => { setActive(id); await loadThread(id); };
  const activeConvo = conversations.find(c => c.id === active);
  const filtered = conversations.filter(c => (c.other_name || '').toLowerCase().includes(search.toLowerCase()));

  const send = async () => {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('send_message', {
      p_conversation_id: active,
      p_body: body,
    });
    if (rpcError) setError(rpcError.message || 'Could not send the message.');
    else {
      setDraft('');
      if (data) setMessages(prev => [...prev, data]);
      await loadConversations();
    }
    setSending(false);
  };

  const blockActive = async () => {
    if (!activeConvo?.other_user_id) return;
    if (!window.confirm(`Block ${activeConvo.other_name || 'this person'}? They won't be able to message you again.`)) return;
    const { error: blockError } = await supabase.rpc('block_user', { p_user_id: activeConvo.other_user_id });
    setThreadMenuOpen(false);
    if (blockError) { setError(blockError.message || 'Could not block this user.'); return; }
    setActive(null);
    await loadConversations();
  };

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 text-center">
        <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#00A8CC' }} />
        <h1 className="cm-display font-bold text-2xl mb-2" style={{ color: '#111827' }}>Messages</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>Sign in to message creators and businesses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="cm-display font-bold text-2xl md:text-3xl" style={{ color: '#111827' }}>Messages</h1><p className="text-xs mt-1" style={{ color: '#6B7280' }}>Private conversations between Commissioner members.</p></div>
        {error && <span className="text-xs max-w-sm text-right" style={{ color: '#B42318' }}>{error}</span>}
      </div>
      <div className="bg-white border rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ borderColor: '#E5E7EB', height: '600px' }}>
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <div className="p-3 border-b" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2" style={{ borderColor: '#E5E7EB', background: '#F8FAFC' }}>
              <Search size={14} style={{ color: '#6B7280' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages" className="flex-1 outline-none text-xs bg-transparent" />
            </div>
          </div>
          <div className="overflow-y-auto cm-scroll flex-1">
            {loading ? <p className="p-6 text-center text-xs" style={{ color: '#6B7280' }}>Loading conversations…</p> : filtered.length === 0 ? (
              <div className="p-6 text-center"><MessageSquare size={22} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} /><p className="text-xs" style={{ color: '#6B7280' }}>No conversations yet. Open a creator profile and choose Message to start one.</p></div>
            ) : filtered.map(c => (
              <button key={c.id} onClick={() => selectConversation(c.id)} className="w-full text-left flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#F3F4F6', background: active === c.id ? '#FDE7F1' : 'white' }}>
                <Avatar name={c.other_name || 'Member'} size={40} tone={c.tone || 0} src={c.other_avatar_url} />
                <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{c.other_name || 'Commissioner member'}</p><span className="text-[11px] shrink-0" style={{ color: '#9CA3AF' }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ''}</span></div><p className="text-xs truncate" style={{ color: c.unread_count ? '#111827' : '#6B7280', fontWeight: c.unread_count ? 600 : 400 }}>{c.last_message || 'No messages yet'}</p></div>
                {c.unread_count > 0 && <span style={{ background: '#E6007A' }} className="min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread_count}</span>}
              </button>
            ))}
          </div>
        </div>
        {!activeConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6"><MessageSquare size={28} style={{ color: '#D1D5DB' }} /><p className="text-sm font-semibold" style={{ color: '#111827' }}>No conversation selected</p><p className="text-xs" style={{ color: '#6B7280' }}>Message a creator or business from their profile to start a conversation.</p></div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3"><Avatar name={activeConvo.other_name || 'Member'} size={36} tone={activeConvo.tone || 0} src={activeConvo.other_avatar_url} /><div><p className="text-sm font-semibold" style={{ color: '#111827' }}>{activeConvo.other_name || 'Commissioner member'}</p><p className="text-[11px]" style={{ color: '#6B7280' }}>{activeConvo.other_type === 'business' ? 'Business' : 'Creator'}</p></div></div>
              <div className="flex items-center gap-2">
                <button style={{ background: '#E0FBFF', color: '#036377' }} className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5"><Briefcase size={13} /> Campaign workspace</button>
                <div className="relative">
                  <button onClick={() => setThreadMenuOpen(o => !o)} className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}><MoreHorizontal size={15} /></button>
                  {threadMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border rounded-xl shadow-lg py-1.5 z-50" style={{ borderColor: '#E5E7EB' }}>
                      <button onClick={() => { setReportOpen(true); setThreadMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: '#374151' }}><Flag size={14} /> Report</button>
                      <button onClick={blockActive} className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: '#DC2626' }}><UserX size={14} /> Block</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto cm-scroll px-5 py-5 flex flex-col gap-3" style={{ background: '#F8FAFC' }}>
              {threadLoading ? <p className="text-center text-xs" style={{ color: '#6B7280' }}>Loading…</p> : messages.map(m => {
                const mine = m.sender_id === session.user.id;
                return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[78%] px-4 py-2.5 rounded-2xl text-sm" style={{ background: mine ? '#E6007A' : 'white', color: mine ? 'white' : '#111827', border: mine ? 'none' : '1px solid #E5E7EB', borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6 }}><p className="whitespace-pre-wrap break-words">{m.body}</p><p className="text-[10px] mt-1 opacity-70 text-right">{new Date(m.created_at).toLocaleString()}</p></div></div>;
              })}
            </div>
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: '#E5E7EB' }}><button type="button" style={{ color: '#00A8CC' }} title="Attachments are coming next"><Paperclip size={18} /></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message" className="flex-1 outline-none text-sm px-2" maxLength={4000} /><button type="submit" disabled={sending || !draft.trim()} style={{ background: '#E6007A', opacity: sending || !draft.trim() ? .5 : 1 }} className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"><Send size={15} /></button></form>
          </div>
        )}
      </div>
      {reportOpen && activeConvo?.other_user_id && (
        <ReportModal targetUserId={activeConvo.other_user_id} conversationId={active} onClose={() => setReportOpen(false)} />
      )}
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



const CreatorAnalytics = ({ profile }) => {
  const [stats,setStats]=useState({});
  useEffect(()=>{if(profile?.id)supabase.rpc('creator_analytics',{p_creator_profile_id:profile.id}).then(({data})=>{const x={};(data||[]).forEach(r=>x[r.event_type]=Number(r.event_count));setStats(x)});},[profile?.id]);
  const cards=[['nfc_tap','NFC taps'],['profile_view','Profile views'],['product_view','Product clicks'],['inquiry_created','Inquiries']];
  return <div className="bg-white border rounded-2xl p-5 mb-6" style={{borderColor:'#E5E7EB'}}><div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Profile analytics</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Simple first-party metrics. No visitor identities are exposed.</p></div><BarChart3 size={18} style={{color:'#036377'}}/></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(([k,l])=><div key={k} className="rounded-xl p-4" style={{background:'#F8FAFC'}}><p className="cm-mono text-xl font-semibold" style={{color:'#111827'}}>{stats[k]||0}</p><p className="text-[11px] mt-1" style={{color:'#6B7280'}}>{l}</p></div>)}</div></div>;
};

const CreatorCommerceManager = ({ profile }) => {
  const [products,setProducts]=useState([]);
  const [form,setForm]=useState({name:'',description:'',price:'',currency:'ETB',type:'product',purchase_url:''});
  const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const load=async()=>{const {data}=await supabase.from('creator_products').select('*').eq('creator_profile_id',profile.id).order('created_at',{ascending:false});setProducts(data||[])};
  useEffect(()=>{if(profile?.id)load()},[profile?.id]);
  const add=async(e)=>{e.preventDefault();setSaving(true);setError('');const {error}=await supabase.from('creator_products').insert({creator_profile_id:profile.id,name:form.name.trim(),description:form.description.trim(),price:form.price?Number(form.price):null,currency:form.currency,type:form.type,purchase_url:form.purchase_url.trim()||null});if(error)setError(error.message);else{setForm({name:'',description:'',price:'',currency:'ETB',type:'product',purchase_url:''});await load()}setSaving(false)};
  const remove=async(id)=>{if(!window.confirm('Remove this item from your public profile?'))return;await supabase.from('creator_products').delete().eq('id',id).eq('creator_profile_id',profile.id);await load()};
  return <div className="bg-white border rounded-2xl p-5 mb-6" style={{borderColor:'#E5E7EB'}}>
    <div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Products & services</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Add merchandise, products, bookings, or services to your public profile.</p></div><ShoppingBag size={18} style={{color:'#036377'}}/></div>
    <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
      <OnboardingField label="Name" placeholder="e.g. Brand promotion package" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
      <OnboardingField label="Price" placeholder="e.g. 2500" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
      <div><label className="text-xs font-semibold block mb-1.5" style={{color:'#374151'}}>Type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none" style={{borderColor:'#E5E7EB'}}><option value="product">Product / merch</option><option value="service">Service / booking</option></select></div>
      <OnboardingField label="Purchase / booking link" placeholder="https://..." value={form.purchase_url} onChange={e=>setForm(f=>({...f,purchase_url:e.target.value}))}/>
      <div className="md:col-span-2"><label className="text-xs font-semibold block mb-1.5" style={{color:'#374151'}}>Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{borderColor:'#E5E7EB'}}/></div>
      <div className="md:col-span-2 flex items-center justify-between"><span className="text-xs" style={{color:'#6B7280'}}>{error&&<span style={{color:'#B42318'}}>{error}</span>}</span><button disabled={saving||!form.name.trim()} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50" style={{background:'#111827'}}>{saving?'Adding…':'Add to profile'}</button></div>
    </form>
    {products.length>0&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{products.map(p=><div key={p.id} className="border rounded-xl px-3 py-3 flex items-center justify-between gap-3" style={{borderColor:'#E5E7EB'}}><div className="min-w-0"><p className="text-xs font-semibold truncate" style={{color:'#111827'}}>{p.name}</p><p className="text-[11px]" style={{color:'#6B7280'}}>{p.type==='service'?'Service':'Product'} · {p.price!=null?`${Number(p.price).toLocaleString()} ${p.currency}`:'Contact'}</p></div><button onClick={()=>remove(p.id)} className="text-[11px] font-semibold" style={{color:'#DC2626'}}>Remove</button></div>)}</div>}
  </div>;
};

const CreatorInquiryInbox = ({ profile }) => {
  const [items,setItems]=useState([]);
  useEffect(()=>{if(profile?.id)supabase.from('creator_inquiries').select('id,name,email,company,budget,message,status,created_at').eq('creator_profile_id',profile.id).order('created_at',{ascending:false}).limit(20).then(({data})=>setItems(data||[]));},[profile?.id]);
  if(!items.length)return <div className="bg-white border rounded-2xl p-5" style={{borderColor:'#E5E7EB'}}><p className="text-sm font-semibold mb-1" style={{color:'#111827'}}>Business inquiries</p><p className="text-xs" style={{color:'#6B7280'}}>No inquiries yet. Businesses and clients can reach you through the Work With Me form on your public profile.</p></div>;
  return <div className="bg-white border rounded-2xl p-5" style={{borderColor:'#E5E7EB'}}><div className="flex items-center justify-between mb-4"><p className="text-sm font-semibold" style={{color:'#111827'}}>Business inquiries</p><span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{background:'#E0FBFF',color:'#036377'}}>{items.length} recent</span></div><div className="flex flex-col gap-3">{items.map(i=><div key={i.id} className="border rounded-xl p-4" style={{borderColor:'#E5E7EB'}}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>{i.name}{i.company?` · ${i.company}`:''}</p><p className="text-xs mt-0.5" style={{color:'#6B7280'}}>{i.email}{i.budget?` · Budget: ${i.budget}`:''}</p></div><span className="text-[10px] font-semibold uppercase" style={{color:i.status==='new'?'#E6007A':'#6B7280'}}>{i.status}</span></div><p className="text-xs leading-6 mt-3" style={{color:'#374151'}}>{i.message}</p></div>)}</div></div>;
};

const CreatorDashboard = ({ session }) => {
  const [profile, setProfile] = useState(null);
  const [ratingSummary, setRatingSummary] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase.rpc('get_rating_summary', { p_user_id: session.user.id }).then(({ data }) => setRatingSummary(data));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('creator_profiles')
      .select('id, page_name, username, avatar_url, city, language, bio, verified, primary_niche, availability, onboarded, approved')
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

    {/* profile completion + trust + marketplace, the beam motif */}
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

    {profile && <CreatorAnalytics profile={{...profile, id: profile.id}} />}
    {profile && <CreatorCommerceManager profile={{...profile, id: profile.id}} />}
    {profile && <div className="mb-6"><CreatorInquiryInbox profile={{...profile, id: profile.id}} /></div>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard icon={ShoppingBag} label="Marketplace listings" value="Manage" />
      <StatCard icon={MessageSquare} label="Unread messages" value="0" />
      <StatCard icon={Briefcase} label="B2B opportunities" value="Connect" />
      <StatCard icon={Award} label="Avg. rating" value={ratingSummary && Number(ratingSummary.count) > 0 ? `${Number(ratingSummary.average).toFixed(1)} ★ (${ratingSummary.count})` : 'Not yet rated'} />
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
            { icon: Shield, l: 'NFC identity', v: 'Ready to link', c: '#036377' },
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


const BusinessListingsManager = ({ profile }) => {
  const [items,setItems]=useState([]); const [form,setForm]=useState({title:'',description:'',listing_type:'service',category:'',price_display:'',external_url:''}); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const load=async()=>{const {data}=await supabase.from('marketplace_listings').select('*').eq('owner_type','business').eq('owner_id',profile.id).order('created_at',{ascending:false});setItems(data||[])};
  useEffect(()=>{if(profile?.id)load()},[profile?.id]);
  const add=async e=>{e.preventDefault();setSaving(true);setError('');const {error}=await supabase.from('marketplace_listings').insert({owner_type:'business',owner_id:profile.id,title:form.title.trim(),description:form.description.trim(),listing_type:form.listing_type,category:form.category.trim(),price_display:form.price_display.trim(),external_url:form.external_url.trim()||null});if(error)setError(error.message);else{setForm({title:'',description:'',listing_type:'service',category:'',price_display:'',external_url:''});await load()}setSaving(false)};
  const remove=async id=>{await supabase.from('marketplace_listings').delete().eq('id',id).eq('owner_type','business').eq('owner_id',profile.id);await load()};
  return <div className="bg-white border rounded-2xl p-5 mb-6" style={{borderColor:'#E5E7EB'}}><div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Business marketplace</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Publish products, merchandise, services, or collaboration offers. Commissioner does not process payments.</p></div><ShoppingBag size={18} style={{color:'#7C3AED'}}/></div><form onSubmit={add} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5"><OnboardingField label="Listing title" placeholder="e.g. Corporate catering" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/><div><label className="text-xs font-semibold block mb-1.5" style={{color:'#374151'}}>Type</label><select value={form.listing_type} onChange={e=>setForm(f=>({...f,listing_type:e.target.value}))} className="w-full border rounded-lg px-3 py-2.5 text-sm" style={{borderColor:'#E5E7EB'}}><option value="service">Service</option><option value="product">Product</option><option value="merch">Merchandise</option><option value="collaboration">Collaboration</option></select></div><OnboardingField label="Category" placeholder="e.g. Hospitality" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/><OnboardingField label="Price / range" placeholder="e.g. From 5,000 ETB" value={form.price_display} onChange={e=>setForm(f=>({...f,price_display:e.target.value}))}/><OnboardingField label="External order / website link" placeholder="https://..." value={form.external_url} onChange={e=>setForm(f=>({...f,external_url:e.target.value}))}/><div className="md:col-span-2"><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="Describe the product, service, or collaboration." className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{borderColor:'#E5E7EB'}}/></div><div className="md:col-span-2 flex items-center justify-between"><span className="text-xs" style={{color:'#B42318'}}>{error}</span><button disabled={saving||!form.title.trim()} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50" style={{background:'#111827'}}>{saving?'Publishing…':'Publish listing'}</button></div></form>{items.length>0&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{items.map(x=><div key={x.id} className="border rounded-xl p-3 flex items-center justify-between gap-3" style={{borderColor:'#E5E7EB'}}><div className="min-w-0"><p className="text-xs font-semibold truncate" style={{color:'#111827'}}>{x.title}</p><p className="text-[11px]" style={{color:'#6B7280'}}>{x.listing_type} · {x.price_display||'Contact'}</p></div><button onClick={()=>remove(x.id)} className="text-[11px] font-semibold" style={{color:'#B42318'}}>Remove</button></div>)}</div>}</div>;
};

const BusinessDashboard = ({ session }) => {
  const [profile,setProfile]=useState(null);
  useEffect(()=>{if(!session)return;supabase.from('business_profiles').select('*').eq('auth_user_id',session.user.id).maybeSingle().then(({data})=>setProfile(data||null))},[session?.user?.id]);
  const completion=[profile?.business_name,profile?.username,profile?.avatar_url,profile?.city,profile?.bio,profile?.industry,profile?.website].filter(Boolean).length/7*100;
  return <div className="max-w-7xl mx-auto px-5 md:px-8 py-10"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"><div className="flex items-center gap-4"><Avatar name={profile?.business_name||session.user.email} size={56} ring src={profile?.avatar_url}/><div><div className="flex items-center gap-2"><h1 className="cm-display font-bold text-xl" style={{color:'#111827'}}>{profile?.business_name||'Your business'}</h1>{profile?.verified&&<VerifiedIcon size={15}/>}</div><p className="text-sm" style={{color:'#6B7280'}}>{profile?.username?`@${profile.username.replace(/^@/,'')}`:'Complete your business profile'}{profile?.city?` · ${profile.city}`:''}</p></div></div><span className="text-xs font-semibold px-3 py-2 rounded-lg" style={{background:'#F3E8FF',color:'#7C3AED'}}>Business account</span></div><div className="bg-white border rounded-2xl p-5 mb-6" style={{borderColor:'#E5E7EB'}}><div className="flex justify-between mb-2"><p className="text-sm font-semibold" style={{color:'#111827'}}>Business profile completion</p><p className="cm-mono text-sm font-semibold" style={{color:'#7C3AED'}}>{Math.round(completion)}%</p></div><div className="h-2 rounded-full" style={{background:'#F3F4F6'}}><div className="h-2 rounded-full" style={{width:`${completion}%`,background:'linear-gradient(90deg,#7C3AED,#00D9FF)'}}/></div></div>{profile&&<BusinessListingsManager profile={profile}/>} {profile&&<div className="mb-6"><VerificationDetails type="business" id={profile.id}/></div>}<div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white border rounded-2xl p-5" style={{borderColor:'#E5E7EB'}}><Briefcase size={18} style={{color:'#7C3AED'}}/><p className="text-sm font-semibold mt-3" style={{color:'#111827'}}>B2B network</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Find creators, suppliers and other businesses.</p></div><div className="bg-white border rounded-2xl p-5" style={{borderColor:'#E5E7EB'}}><MessageSquare size={18} style={{color:'#036377'}}/><p className="text-sm font-semibold mt-3" style={{color:'#111827'}}>Professional inbox</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Keep conversations and collaboration requests in one place.</p></div><div className="bg-white border rounded-2xl p-5" style={{borderColor:'#E5E7EB'}}><Shield size={18} style={{color:'#0E7A3B'}}/><p className="text-sm font-semibold mt-3" style={{color:'#111827'}}>Trust information</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Show the facts you have verified to potential partners.</p></div></div></div>;
};

const Dashboard = ({ session }) => {
  const isBusiness = session?.user?.user_metadata?.role === 'business';
  return isBusiness ? <BusinessDashboard session={session}/> : <CreatorDashboard session={session}/>;
};

const BusinessOnboarding = ({ session, setPage }) => {
  const [form,setForm]=useState({business_name:'',username:'',city:'',language:'',bio:'',industry:'',website:''}); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{if(!session)return;supabase.from('business_profiles').select('business_name,username,city,language,bio,industry,website').eq('auth_user_id',session.user.id).maybeSingle().then(({data})=>data&&setForm({...form,...data}))},[session?.user?.id]);
  const save=async()=>{setSaving(true);setError('');const {error}=await supabase.from('business_profiles').update({...form,onboarded:true}).eq('auth_user_id',session.user.id);setSaving(false);if(error)setError(error.message);else setPage('dashboard')};
  return <div className="max-w-2xl mx-auto px-5 md:px-8 py-12"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-wider" style={{color:'#7C3AED'}}>Business setup</p><h1 className="cm-display font-bold text-2xl mt-1" style={{color:'#111827'}}>Build your business identity</h1><p className="text-sm mt-2" style={{color:'#6B7280'}}>Add the public information partners and customers need to make an informed decision.</p></div><div className="bg-white border rounded-2xl p-6 md:p-8" style={{borderColor:'#E5E7EB'}}><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><OnboardingField label="Business name" placeholder="Registered / public name" value={form.business_name} onChange={e=>setForm(f=>({...f,business_name:e.target.value}))}/><OnboardingField label="Username" placeholder="@company" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))}/><OnboardingField label="City" placeholder="Addis Ababa" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/><OnboardingField label="Language" placeholder="English, Amharic…" value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value}))}/><OnboardingField label="Industry" placeholder="Retail, technology…" value={form.industry} onChange={e=>setForm(f=>({...f,industry:e.target.value}))}/><OnboardingField label="Official website" placeholder="https://" value={form.website} onChange={e=>setForm(f=>({...f,website:e.target.value}))}/></div><textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} rows={4} placeholder="Describe what the business does." className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none mt-4" style={{borderColor:'#E5E7EB'}}/><div className="flex items-center justify-between mt-5"><p className="text-xs" style={{color:'#B42318'}}>{error}</p><button onClick={save} disabled={saving||!form.business_name.trim()} className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-50" style={{background:'#7C3AED'}}>{saving?'Saving…':'Save business profile'}</button></div></div></div>;
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
              {v.verified && <VerifiedIcon size={12} />}
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

const AboutUs = () => (
  <div className="max-w-5xl mx-auto px-5 md:px-8 py-14">
    <div className="text-center mb-14">
      <h1 className="cm-display font-bold text-3xl md:text-4xl mb-4" style={{ color: '#111827' }}>About Commissioner</h1>
      <p className="text-sm md:text-base max-w-xl mx-auto" style={{ color: '#6B7280' }}>
        Commissioner is a marketplace built to connect creators and businesses professionally — with verified profiles,
        transparent pricing, and real accountability on both sides.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
      <div className="rounded-2xl border p-7 bg-white" style={{ borderColor: '#E5E7EB' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: '#FDE7F1' }}>
          <Heart size={20} style={{ color: '#E6007A' }} />
        </div>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>Our mission</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          We're building the trust layer creators and brands have been missing — real audience verification, clear pricing,
          and a marketplace where a badge actually means something.
        </p>
      </div>
      <div className="rounded-2xl border p-7 bg-white" style={{ borderColor: '#E5E7EB' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: '#E0FBFF' }}>
          <Shield size={20} style={{ color: '#036377' }} />
        </div>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>How we work</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          Every verified creator on Commissioner goes through account-ownership and audience checks before the badge appears —
          nothing is just self-declared.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 rounded-2xl border p-8 md:p-10" style={{ borderColor: '#E5E7EB', background: '#F8FAFC' }}>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Mail size={18} style={{ color: '#E6007A' }} />
          <h2 className="font-semibold text-base" style={{ color: '#111827' }}>Contact us</h2>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B7280' }}>
          Have a question, partnership idea, or press inquiry? Reach out and a real person from the Commissioner team
          will get back to you.
        </p>
        <a href="mailto:commissionerformylord@gmail.com" className="text-sm font-semibold inline-flex items-center gap-2 mb-4" style={{ color: '#E6007A' }}>
          <Mail size={14} /> commissionerformylord@gmail.com
        </a>
        <div className="flex items-center gap-3">
          <a
            href="https://www.facebook.com/profile.php?id=61593362057721"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Commissioner on Facebook"
            className="w-9 h-9 rounded-lg flex items-center justify-center border hover:opacity-80"
            style={{ borderColor: '#E5E7EB' }}
          >
            <Facebook size={16} style={{ color: '#1877F2' }} />
          </a>
          <a
            href="https://www.instagram.com/commissioner.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Commissioner on Instagram"
            className="w-9 h-9 rounded-lg flex items-center justify-center border hover:opacity-80"
            style={{ borderColor: '#E5E7EB' }}
          >
            <Instagram size={16} style={{ color: '#E6007A' }} />
          </a>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={18} style={{ color: '#036377' }} />
          <h2 className="font-semibold text-base" style={{ color: '#111827' }}>Customer support</h2>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B7280' }}>
          Running into an issue with your account, a payment, or a verification application? Our support team is here to
          help creators and businesses sort it out quickly — email us and we'll follow up as soon as we can.
        </p>
        <a href="mailto:commissionerformylord@gmail.com" className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: '#036377' }}>
          <Mail size={14} /> commissionerformylord@gmail.com
        </a>
      </div>
    </div>
  </div>
);

const TrustSafety = () => (
  <div className="max-w-3xl mx-auto px-5 md:px-8 py-14">
    <div className="text-center mb-12">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#E0FBFF' }}>
        <Shield size={22} style={{ color: '#036377' }} />
      </div>
      <h1 className="cm-display font-bold text-3xl md:text-4xl mb-3" style={{ color: '#111827' }}>Trust & Safety</h1>
      <p className="text-sm max-w-lg mx-auto" style={{ color: '#6B7280' }}>How Commissioner works to keep creators and businesses safe — and what you can do to protect yourself.</p>
    </div>

    <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: '#E5E7EB', background: '#F8FAFC' }}>
      <p className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>What Commissioner is — and isn't</p>
      <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
        Commissioner helps creators and businesses discover each other, message directly, and build a track record through
        verification and reviews. Commissioner does not currently process payments between members — any payment
        arrangement is made directly between you and the other party, so use the same judgment you would with any
        independent deal.
      </p>
    </div>

    {[
      { icon: CheckCircle2, t: 'What "Verified" actually means', d: 'A blue badge means Commissioner checked account ownership and, for creators, audience size. It is not a guarantee of good conduct in a deal — always use good judgment alongside it.' },
      { icon: Lock, t: 'Keep the conversation on Commissioner', d: 'Be cautious if someone pushes hard to move to WhatsApp or Telegram before you\'ve had any real conversation here. Off-platform requests are one of the most common scam patterns on creator marketplaces.' },
      { icon: DollarSign, t: 'Protect yourself on payment', d: 'Businesses: avoid paying 100% upfront to an unproven creator. Creators: avoid delivering finished work in full before any payment or commitment is confirmed. Milestones and partial payments reduce risk for both sides.' },
      { icon: Star, t: 'Reviews build the track record', d: 'Leave an honest review after working with someone — reviews are the main signal future partners use to judge reliability, so they only work if people actually leave them.' },
      { icon: Flag, t: 'Report anything that feels wrong', d: 'Every profile and every conversation has a Report option. Use it for scams, fake profiles, harassment, or a no-show after an agreement — our team reviews every report.' },
      { icon: UserX, t: 'Block whenever you need to', d: 'You can block anyone from a conversation at any time. Blocking stops them from messaging you again and hides you from being contacted by them.' },
    ].map(s => (
      <div key={s.t} className="flex items-start gap-4 py-5 border-b" style={{ borderColor: '#E5E7EB' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FDE7F1' }}>
          <s.icon size={17} style={{ color: '#E6007A' }} />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>{s.t}</p>
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{s.d}</p>
        </div>
      </div>
    ))}

    <div className="mt-8 text-center">
      <p className="text-xs" style={{ color: '#9CA3AF' }}>Something happen that isn't covered here? Reach out at <a href="mailto:commissionerformylord@gmail.com" className="font-semibold" style={{ color: '#036377' }}>commissionerformylord@gmail.com</a></p>
    </div>
  </div>
);

const TermsOfService = () => (
  <div className="max-w-3xl mx-auto px-5 md:px-8 py-14">
    <h1 className="cm-display font-bold text-3xl md:text-4xl mb-2" style={{ color: '#111827' }}>Terms of Service</h1>
    <p className="text-xs mb-10" style={{ color: '#9CA3AF' }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>

    <div className="flex flex-col gap-8 text-sm leading-relaxed" style={{ color: '#374151' }}>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>1. What Commissioner is</h2>
        <p>Commissioner is a discovery and messaging marketplace that connects creators and businesses. Commissioner does not currently process payments, hold funds in escrow, or guarantee the outcome of any deal between members — arrangements made between a creator and a business are between those two parties.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>2. Accounts</h2>
        <p>You're responsible for the accuracy of the information on your profile and for keeping your login secure. Impersonating another person or business, or creating a profile for someone without their permission, is not allowed.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>3. Verification</h2>
        <p>Verification confirms account ownership and, for creators, audience size at the time of review. It does not certify a member's conduct, reliability, or the quality of their work, and can be revoked if evidence becomes invalid.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>4. Acceptable use</h2>
        <p>You agree not to use Commissioner to scam, harass, or defraud other members; post fake statistics or content; scrape or misuse other members' data; or attempt to bypass account restrictions such as blocks or privacy settings.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>5. Reviews & reporting</h2>
        <p>Reviews should reflect a genuine interaction with the person you're reviewing. Reports are reviewed by the Commissioner team and may result in a warning, restricted visibility, or account removal.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>6. Disputes between members</h2>
        <p>Since Commissioner doesn't process payments, disputes over payment or deliverables are between the members involved. Commissioner can review reports and restrict accounts found to have violated these terms, but can't guarantee a refund or force delivery of work.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>7. Your data</h2>
        <p>What we collect and how it's used is covered in our Privacy Policy. You can control who sees your profile details and who can message you from Account settings, and you can request account deletion at any time.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>8. Changes</h2>
        <p>We may update these terms as Commissioner adds features like payments. We'll update the date at the top of this page when that happens.</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2" style={{ color: '#111827' }}>9. Contact</h2>
        <p>Questions about these terms — <a href="mailto:commissionerformylord@gmail.com" className="font-semibold" style={{ color: '#036377' }}>commissionerformylord@gmail.com</a>.</p>
      </section>
    </div>
  </div>
);

const REPORT_REASONS = [
  { value: 'scam_or_fraud', label: 'Scam or fraud' },
  { value: 'fake_profile_or_stats', label: 'Fake profile or inflated stats' },
  { value: 'no_show_after_agreement', label: "Didn't deliver / paid but ghosted" },
  { value: 'harassment_or_abuse', label: 'Harassment or abuse' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

const ReportModal = ({ targetUserId, conversationId = null, onClose }) => {
  const [reason, setReason] = useState('scam_or_fraud');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSending(true); setError('');
    const { error: rpcError } = await supabase.rpc('submit_report', {
      p_reported_user_id: targetUserId,
      p_reason: reason,
      p_details: details || null,
      p_conversation_id: conversationId,
    });
    setSending(false);
    if (rpcError) { setError(rpcError.message || 'Could not submit the report.'); return; }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(17,24,39,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-2">
            <CheckCircle2 size={26} className="mx-auto mb-3" style={{ color: '#0E7A3B' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Report submitted</p>
            <p className="text-xs mb-5" style={{ color: '#6B7280' }}>Thanks for flagging this — our team will review it.</p>
            <button onClick={onClose} className="text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: '#111827', color: 'white' }}>Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4"><Flag size={17} style={{ color: '#DC2626' }} /><p className="text-sm font-semibold" style={{ color: '#111827' }}>Report this account</p></div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>What's going on?</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm mb-3" style={{ borderColor: '#E5E7EB' }}>
              {REPORT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} placeholder="Any extra detail that would help us review this (optional)" className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none" style={{ borderColor: '#E5E7EB' }} />
            {error && <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{error}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 text-sm font-semibold py-2.5 rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Cancel</button>
              <button onClick={submit} disabled={sending} className="flex-1 text-sm font-semibold py-2.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#DC2626' }}>{sending ? 'Submitting…' : 'Submit report'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const RatingSummary = ({ userId }) => {
  const [summary, setSummary] = useState(null);
  useEffect(() => { if (userId) supabase.rpc('get_rating_summary', { p_user_id: userId }).then(({ data }) => setSummary(data)); }, [userId]);
  if (!summary) return null;
  const avg = Number(summary.average) || 0;
  const count = Number(summary.count) || 0;
  if (count === 0) return <span className="text-xs" style={{ color: '#9CA3AF' }}>No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#111827' }}>
      <Star size={14} fill="#F59E0B" style={{ color: '#F59E0B' }} /> {avg.toFixed(1)} <span className="text-xs font-normal" style={{ color: '#6B7280' }}>({count} review{count === 1 ? '' : 's'})</span>
    </span>
  );
};

const LeaveReviewBox = ({ targetUserId, session, onSaved }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!session || session.user.id === targetUserId) return null;

  const submit = async () => {
    if (!rating) { setMsg('Pick a star rating first.'); return; }
    setSaving(true); setMsg('');
    const { error } = await supabase.rpc('upsert_review', { p_reviewee_id: targetUserId, p_rating: rating, p_comment: comment || null });
    setSaving(false);
    if (error) { setMsg(error.message || 'Could not save your review.'); return; }
    setMsg('Review saved. Thank you!');
    if (onSaved) onSaved();
  };

  return (
    <div className="rounded-2xl border p-5 mb-7" style={{ borderColor: '#E5E7EB' }}>
      <p className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>Leave a review</p>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} type="button">
            <Star size={22} fill={(hover || rating) >= n ? '#F59E0B' : 'none'} style={{ color: (hover || rating) >= n ? '#F59E0B' : '#D1D5DB' }} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Optional — how did the collaboration go?" className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none mb-3" style={{ borderColor: '#E5E7EB' }} />
      <button onClick={submit} disabled={saving} className="text-sm font-semibold px-4 py-2.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#111827' }}>{saving ? 'Saving…' : 'Submit review'}</button>
      {msg && <p className="text-xs mt-2" style={{ color: msg.includes('saved') ? '#0E7A3B' : '#DC2626' }}>{msg}</p>}
    </div>
  );
};

const ReviewsList = ({ userId, refreshKey }) => {
  const [reviews, setReviews] = useState([]);
  useEffect(() => { if (userId) supabase.rpc('get_reviews_for_user', { p_user_id: userId, p_limit: 10 }).then(({ data }) => setReviews(Array.isArray(data) ? data : [])); }, [userId, refreshKey]);
  if (reviews.length === 0) return null;
  return (
    <div className="mb-7">
      <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Reviews</p>
      <div className="flex flex-col gap-3">
        {reviews.map(r => (
          <div key={r.id} className="border rounded-xl p-4" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Avatar name={r.reviewer_name || 'Member'} size={26} src={r.reviewer_avatar_url} />
                <p className="text-xs font-semibold" style={{ color: '#111827' }}>{r.reviewer_name}</p>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={12} fill={n <= r.rating ? '#F59E0B' : 'none'} style={{ color: n <= r.rating ? '#F59E0B' : '#D1D5DB' }} />)}
              </div>
            </div>
            {r.comment && <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{r.comment}</p>}
          </div>
        ))}
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

const Onboarding = ({ session, setPage, editMode = false, onSaved }) => {
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

  // When opening the builder from the public profile, load the existing profile
  // so Edit Profile edits the current record instead of creating/replacing it.
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('creator_profiles')
        .select('page_name, username, city, language, bio, avatar_url, banner_url, platforms, primary_niche, secondary_niches, audience, services, portfolio_link, availability, professional_preferences, onboarded')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setPageName(data.page_name || '');
      setUsername(data.username || '');
      setLocation(data.city || '');
      setLanguage(data.language || '');
      setBio(data.bio || '');
      setAvatarPreview(data.avatar_url || '');
      setBannerPreview(data.banner_url || '');
      setSocials(data.platforms && typeof data.platforms === 'object' ? data.platforms : {});
      setPrimaryNiche(data.primary_niche || '');
      setSecondary(Array.isArray(data.secondary_niches) ? data.secondary_niches : []);
      const aud = data.audience && typeof data.audience === 'object' ? data.audience : {};
      setAudienceAge(aud.age || '');
      setAudienceGender(aud.gender || '');
      setAudienceLocation(aud.location || '');
      setAvgViews(aud.avg_views || '');
      setAvgReach(aud.avg_reach || '');
      setPricing(data.services && typeof data.services === 'object' ? { tiktok: '', reel: '', story: '', youtube: '', monthly: '', ugc: '', ...data.services } : { tiktok: '', reel: '', story: '', youtube: '', monthly: '', ugc: '' });
      setPortfolioLink(data.portfolio_link || '');
      setAvailability(data.availability || 'Available now');
      setPreferences(data.professional_preferences || '');
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

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
      if (onSaved) setTimeout(() => onSaved(), 700); else setTimeout(() => setPage('dashboard'), 1200);
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
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{editMode ? 'Profile updated successfully.' : "Profile submitted — it's now pending approval."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="cm-display font-bold text-2xl mb-2" style={{ color: '#111827' }}>{editMode ? 'Edit your creator profile' : 'Set up your creator profile'}</h1>
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
            <OnboardingField label="Page name" placeholder="e.g. Sunrise Kitchen" value={pageName} onChange={e => setPageName(e.target.value)} />
            <OnboardingField label="Creator username" placeholder="e.g. @sunrise.kitchen" value={username} onChange={e => setUsername(e.target.value)} />

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
              <OnboardingField label="TikTok video" placeholder="ETB" value={pricing.tiktok} onChange={e => setPricing(p => ({ ...p, tiktok: e.target.value }))} />
              <OnboardingField label="Instagram Reel" placeholder="ETB" value={pricing.reel} onChange={e => setPricing(p => ({ ...p, reel: e.target.value }))} />
              <OnboardingField label="Story" placeholder="ETB" value={pricing.story} onChange={e => setPricing(p => ({ ...p, story: e.target.value }))} />
              <OnboardingField label="YouTube video" placeholder="ETB" value={pricing.youtube} onChange={e => setPricing(p => ({ ...p, youtube: e.target.value }))} />
              <OnboardingField label="Monthly collaboration" placeholder="ETB" value={pricing.monthly} onChange={e => setPricing(p => ({ ...p, monthly: e.target.value }))} />
              <OnboardingField label="UGC content" placeholder="ETB" value={pricing.ugc} onChange={e => setPricing(p => ({ ...p, ugc: e.target.value }))} />
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
          {saving ? (uploadingAvatar || uploadingBanner ? 'Uploading…' : 'Saving…') : step === ONBOARDING_STEPS.length - 1 ? (editMode ? 'Save changes' : 'Finish setup') : 'Continue'} <ArrowRight size={15} />
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
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const handleDeleteAccount = async () => {
    setDeleting(true); setDeleteError('');
    const { error } = await supabase.rpc('request_account_deletion');
    if (error) { setDeleteError(error.message || 'Could not process the deletion request.'); setDeleting(false); return; }
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

      <div className="border rounded-2xl p-6 mt-6" style={{ borderColor: '#FCA5A5', background: '#FEF2F2' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: '#991B1B' }}>Delete account</p>
        <p className="text-xs mb-4" style={{ color: '#B91C1C' }}>
          This unpublishes your profile, removes your bio/photos/links, and hides your details from other members.
          It signs you out of every device. Message history stays on the other person's side of any conversation.
        </p>
        {!deleteConfirming ? (
          <button onClick={() => setDeleteConfirming(true)} className="text-xs font-semibold px-4 py-2.5 rounded-lg border" style={{ borderColor: '#DC2626', color: '#DC2626' }}>Delete my account</button>
        ) : (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: '#991B1B' }}>Are you sure? This can't be undone from your account.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirming(false)} className="text-xs font-semibold px-4 py-2.5 rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleting} className="text-xs font-semibold px-4 py-2.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#DC2626' }}>{deleting ? 'Deleting…' : 'Yes, delete my account'}</button>
            </div>
          </div>
        )}
        {deleteError && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{deleteError}</p>}
      </div>
    </div>
  );
};

const CreatorClaimForm = ({ token }) => {
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
        <p className="text-sm" style={{ color: '#6B7280' }}>{pageName ? `You're setting up the profile for ${pageName}.` : "You're setting up your creator profile."} This is the page your NFC card will open. No account needed — fill in the public details and submit.</p>
      </div>

      <div className="bg-white border rounded-2xl p-6 md:p-8 flex flex-col gap-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="grid grid-cols-2 gap-4">
          <ImageUploadTile label="Profile photo" shape="circle" previewUrl={avatarPreview} onFile={handleAvatarFile} uploading={uploadingAvatar} />
          <ImageUploadTile label="Cover / banner image" shape="banner" previewUrl={bannerPreview} onFile={handleBannerFile} uploading={uploadingBanner} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <OnboardingField label="Page name" placeholder="e.g. Sunrise Kitchen" value={pageName} onChange={e => setPageName(e.target.value)} />
          <OnboardingField label="Username" placeholder="e.g. sunrise.kitchen" icon={AtSign} value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} />
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

const BusinessClaimForm = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [lookingFor, setLookingFor] = useState([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [preferences, setPreferences] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.rpc('get_claim_business', { p_token: token }).then(({ data, error }) => {
      if (error || !data || data.length === 0) { setNotFound(true); setLoading(false); return; }
      const row = data[0];
      setBusinessName(row.business_name || '');
      setIndustry(row.industry || '');
      setUsername(row.username || '');
      setCity(row.city || '');
      setLanguage(row.language || '');
      setBio(row.bio || '');
      setWebsite(row.website || '');
      setLookingFor(row.looking_for || []);
      setBudgetRange(row.budget_range || '');
      setPreferences(row.preferences || '');
      setAvatarPreview(row.avatar_url || '');
      setBannerPreview(row.banner_url || '');
      setLoading(false);
    });
  }, [token]);

  const toggleLookingFor = (l) => setLookingFor(lf => lf.includes(l) ? lf.filter(x => x !== l) : [...lf, l]);
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
      const { data, error } = await supabase.rpc('claim_business', {
        p_token: token,
        p_business_name: businessName,
        p_username: username,
        p_city: city,
        p_language: language,
        p_bio: bio,
        p_avatar_url: avatarUrl || avatarPreview || null,
        p_banner_url: bannerUrl || bannerPreview || null,
        p_website: website,
        p_looking_for: lookingFor,
        p_budget_range: budgetRange,
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

  if (loading) return <div className="max-w-2xl mx-auto px-5 md:px-8 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading your page…</div>;

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
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Page saved</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>It's pending approval — bookmark this link if you'd like to come back and make changes before then.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="cm-display font-bold text-2xl mb-2" style={{ color: '#111827' }}>Finish your business page</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>{businessName ? `You're setting up the page for ${businessName}.` : "You're setting up your business page."} This is the page your NFC card will open. No account needed — fill in the public details and submit.</p>
      </div>

      <div className="bg-white border rounded-2xl p-6 md:p-8 flex flex-col gap-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="grid grid-cols-2 gap-4">
          <ImageUploadTile label="Logo" shape="circle" previewUrl={avatarPreview} onFile={handleAvatarFile} uploading={uploadingAvatar} />
          <ImageUploadTile label="Cover / banner image" shape="banner" previewUrl={bannerPreview} onFile={handleBannerFile} uploading={uploadingBanner} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <OnboardingField label="Business name" placeholder="e.g. Sunrise Kitchen Co." value={businessName} onChange={e => setBusinessName(e.target.value)} />
          <OnboardingField label="Username" placeholder="e.g. sunrisekitchen" icon={AtSign} value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <OnboardingField label="City" placeholder="e.g. Addis Ababa" icon={MapPin} value={city} onChange={e => setCity(e.target.value)} />
          <OnboardingField label="Language" placeholder="e.g. Amharic, English" icon={Languages} value={language} onChange={e => setLanguage(e.target.value)} />
        </div>
        <OnboardingField label="Website" placeholder="https://" icon={Globe} value={website} onChange={e => setWebsite(e.target.value)} />
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>About the business</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="What do you do, and what kind of creators are you looking for?" rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
        </div>

        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>What are you looking for?</p>
          <div className="flex flex-wrap gap-2">
            {LOOKING_FOR_OPTIONS.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLookingFor(l)}
                className="text-xs font-semibold px-3.5 py-2 rounded-full border flex items-center gap-1"
                style={{
                  background: lookingFor.includes(l) ? '#E0FBFF' : 'white',
                  color: lookingFor.includes(l) ? '#036377' : '#374151',
                  borderColor: lookingFor.includes(l) ? '#00D9FF' : '#E5E7EB'
                }}
              >
                {lookingFor.includes(l) && <Check size={11} strokeWidth={3} />}
                {l}
              </button>
            ))}
          </div>
        </div>

        <OnboardingField label="Typical budget range" placeholder="e.g. 5,000–15,000 ETB per campaign" icon={DollarSign} value={budgetRange} onChange={e => setBudgetRange(e.target.value)} />
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Anything else creators should know? <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
          <textarea value={preferences} onChange={e => setPreferences(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ background: '#E6007A' }}
          className="text-white text-sm font-semibold px-5 py-3 rounded-lg disabled:opacity-50 self-start flex items-center gap-1.5"
        >
          {saving ? (uploadingAvatar || uploadingBanner ? 'Uploading…' : 'Saving…') : 'Submit page'} <ArrowRight size={15} />
        </button>
        {saveError && <p className="text-xs" style={{ color: '#DC2626' }}>{saveError}</p>}
      </div>
    </div>
  );
};


const WorkWithMe = ({ profile }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', company:'', budget:'', message:'' });
  const [state, setState] = useState({ saving:false, done:false, error:'' });
  const update = (k,v) => setForm(f => ({...f,[k]:v}));
  const submit = async (e) => {
    e.preventDefault(); setState({saving:true,done:false,error:''});
    const { error } = await supabase.rpc('submit_creator_inquiry', { p_creator_profile_id: profile.id, p_name:form.name, p_email:form.email, p_company:form.company, p_budget:form.budget, p_message:form.message });
    if (error) setState({saving:false,done:false,error:error.message || 'Could not send inquiry.'});
    else { setState({saving:false,done:true,error:''}); supabase.rpc('track_profile_event',{p_creator_profile_id:profile.id,p_event_type:'inquiry_created'}).catch(()=>{}); }
  };
  if (state.done) return <div className="border rounded-2xl p-5" style={{borderColor:'#BBF7D0',background:'#F0FDF4'}}><div className="flex items-center gap-2 font-semibold text-sm" style={{color:'#166534'}}><CheckCircle2 size={16}/> Inquiry sent successfully.</div><p className="text-xs mt-1" style={{color:'#166534'}}>The creator can review your request from their dashboard.</p></div>;
  return <div className="border rounded-2xl p-5" style={{borderColor:'#E5E7EB',background:'#FFFFFF'}}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Work with {profile.page_name || 'this creator'}</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Send a private business or collaboration inquiry.</p></div><Briefcase size={18} style={{color:'#036377'}}/></div>
    {!open ? <button onClick={()=>setOpen(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white" style={{background:'#111827'}}>Start an inquiry <ArrowRight size={14}/></button> :
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><OnboardingField label="Your name" placeholder="Your name" value={form.name} onChange={e=>update('name',e.target.value)}/><OnboardingField label="Email" placeholder="you@company.com" value={form.email} onChange={e=>update('email',e.target.value)} type="email"/></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><OnboardingField label="Company / brand" placeholder="Optional" value={form.company} onChange={e=>update('company',e.target.value)}/><OnboardingField label="Budget" placeholder="e.g. 20,000 ETB" value={form.budget} onChange={e=>update('budget',e.target.value)}/></div>
      <textarea required value={form.message} onChange={e=>update('message',e.target.value)} placeholder="What would you like to work on?" rows={4} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{borderColor:'#E5E7EB'}}/>
      {state.error && <p className="text-xs" style={{color:'#B42318'}}>{state.error}</p>}
      <div className="flex gap-2"><button type="submit" disabled={state.saving} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50" style={{background:'#E6007A'}}>{state.saving?'Sending…':'Send inquiry'}</button><button type="button" onClick={()=>setOpen(false)} className="text-sm font-semibold px-4 py-2.5 rounded-lg border" style={{borderColor:'#E5E7EB'}}>Cancel</button></div>
    </form>}
  </div>;
};

const CreatorProducts = ({ profile }) => {
  const [products,setProducts]=useState([]);
  useEffect(()=>{ supabase.from('creator_products').select('id,name,description,image_url,price,currency,type,purchase_url').eq('creator_profile_id',profile.id).eq('active',true).order('created_at',{ascending:false}).then(({data})=>setProducts(data||[])); },[profile.id]);
  if(!products.length) return null;
  return <div className="mb-8"><div className="flex items-center gap-2 mb-3"><ShoppingBag size={17} style={{color:'#036377'}}/><p className="text-sm font-semibold" style={{color:'#111827'}}>Products & services</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{products.map(p=><div key={p.id} className="border rounded-2xl overflow-hidden bg-white" style={{borderColor:'#E5E7EB'}}>{p.image_url&&<img src={p.image_url} alt="" className="w-full h-36 object-cover"/>}<div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>{p.name}</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>{p.description}</p></div><span className="text-xs font-bold whitespace-nowrap" style={{color:'#111827'}}>{p.price != null ? `${Number(p.price).toLocaleString()} ${p.currency}` : 'Contact'}</span></div>{p.purchase_url&&<a href={p.purchase_url} target="_blank" rel="noreferrer" onClick={()=>supabase.rpc('track_profile_event',{p_creator_profile_id:profile.id,p_event_type:'product_view'}).catch(()=>{})} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white" style={{background:'#111827'}}>{p.type==='service'?'Book / enquire':'Buy / order'} <ArrowUpRight size={13}/></a>}</div></div>)}</div></div>;
};

const PublicCreatorProfile = ({ profile, canEdit = false, onEdit, session, setPage }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  const socials = profile.platforms && typeof profile.platforms === 'object' ? profile.platforms : {};
  const socialEntries = Object.entries(socials).filter(([, value]) => value && (value.handle || value.url));
  const services = profile.services && typeof profile.services === 'object' ? profile.services : {};
  const serviceEntries = Object.entries(services).filter(([, value]) => value);
  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <div className="bg-white border rounded-3xl overflow-hidden shadow-sm" style={{ borderColor: '#E5E7EB' }}>
          <div className="h-36 md:h-48 relative" style={{ background: profile.banner_url ? `url(${profile.banner_url}) center/cover` : 'linear-gradient(120deg,#111827,#334155)' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 35%, rgba(17,24,39,.55))' }} />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: '#111827' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#0E7A3B' }} /> Commissioner profile
            </div>
          </div>
          <div className="px-5 md:px-8 pb-8">
            <div className="-mt-12 relative flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
              <div className="relative shrink-0 w-fit">
                <Avatar name={profile.page_name || profile.username || 'Creator'} size={96} ring src={profile.avatar_url} />
                {profile.verified && (
                  <span
                    className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full flex items-center justify-center border-4 border-white shadow-sm"
                    style={{ background: '#0095F6', color: '#FFFFFF' }}
                    role="img"
                    aria-label="Verified by Commissioner"
                    title="Verified by Commissioner"
                  >
                    <Check size={14} strokeWidth={3.2} />
                  </span>
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="cm-display font-bold text-2xl md:text-3xl" style={{ color: '#111827' }}>{profile.page_name || profile.username || 'Creator'}</h1>
                </div>
                <p className="text-sm" style={{ color: '#6B7280' }}>{profile.username ? `@${profile.username.replace(/^@/, '')}` : ''}{profile.city ? ` · ${profile.city}` : ''}</p>
                <div className="mt-1.5"><RatingSummary userId={profile.auth_user_id} /></div>
              </div>
              {!canEdit && profile.auth_user_id && (
                <button onClick={() => setReportOpen(true)} className="ml-auto sm:ml-0 sm:mb-1 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
                  <Flag size={13} /> Report
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {profile.primary_niche && <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#FDE7F1', color: '#99154F' }}>{profile.primary_niche}</span>}
              {profile.language && <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#E0FBFF', color: '#036377' }}>{profile.language}</span>}
              {profile.availability && <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#E9FBEF', color: '#0E7A3B' }}>{profile.availability}</span>}
            </div>
            {profile.bio && <p className="text-sm leading-7 mb-7" style={{ color: '#374151' }}>{profile.bio}</p>}
            <div className="mb-7"><VerificationDetails type="creator" id={profile.id} /></div>
            <CreatorProducts profile={profile} />
            <WorkWithMe profile={profile} />
            {socialEntries.length > 0 && (
              <div className="mb-7">
                <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Social platforms</p>
                <div className="flex flex-wrap gap-2">
                  {socialEntries.map(([platform, value]) => {
                    const href = value.url || (value.handle && /^https?:\/\//.test(value.handle) ? value.handle : null);
                    return href ? (
                      <a key={platform} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 border rounded-xl px-3 py-2 text-xs font-semibold hover:bg-gray-50" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                        <PlatformIcon p={platform.toLowerCase()} /> {platform} {value.handle && !value.handle.startsWith('http') ? `· ${value.handle}` : ''}
                      </a>
                    ) : (
                      <span key={platform} className="flex items-center gap-2 border rounded-xl px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E5E7EB', color: '#374151' }}><PlatformIcon p={platform.toLowerCase()} /> {platform} · {value.handle}</span>
                    );
                  })}
                </div>
              </div>
            )}
            {serviceEntries.length > 0 && (
              <div className="mb-7">
                <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Collaboration services</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {serviceEntries.map(([name, price]) => <div key={name} className="border rounded-xl px-3 py-3 flex items-center justify-between text-xs" style={{ borderColor: '#E5E7EB' }}><span className="font-semibold capitalize" style={{ color: '#374151' }}>{name.replaceAll('_',' ')}</span><span className="cm-mono font-semibold" style={{ color: '#111827' }}>{String(price)}</span></div>)}
                </div>
              </div>
            )}
            {profile.portfolio_link && <a href={profile.portfolio_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl text-white" style={{ background: '#111827' }}><Globe size={15} /> View portfolio <ArrowUpRight size={15} /></a>}
            {profile.auth_user_id && (
              <div className="mt-8 pt-7 border-t" style={{ borderColor: '#E5E7EB' }}>
                <LeaveReviewBox targetUserId={profile.auth_user_id} session={session} onSaved={() => setReviewRefresh(k => k + 1)} />
                <ReviewsList userId={profile.auth_user_id} refreshKey={reviewRefresh} />
              </div>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold bg-white hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#E5E7EB', color: '#111827' }}
            >
              <Settings size={16} /> Edit Profile
            </button>
          </div>
        )}
        <div className="text-center mt-5 text-xs" style={{ color: '#9CA3AF' }}>Verified creator profile powered by Commissioner</div>
      </div>
      {reportOpen && profile.auth_user_id && <ReportModal targetUserId={profile.auth_user_id} onClose={() => setReportOpen(false)} />}
    </div>
  );
};

const PublicBusinessProfile = ({ profile, session }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  return (
  <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-12">
      <div className="bg-white border rounded-3xl overflow-hidden shadow-sm" style={{ borderColor: '#E5E7EB' }}>
        <div className="h-36 md:h-48 relative" style={{ background: profile.banner_url ? `url(${profile.banner_url}) center/cover` : 'linear-gradient(120deg,#111827,#334155)' }}>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: '#111827' }}><span className="w-2 h-2 rounded-full" style={{ background: '#0E7A3B' }} /> Commissioner business profile</div>
        </div>
        <div className="px-5 md:px-8 pb-8">
          <div className="-mt-12 relative flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
            <div className="relative shrink-0 w-fit">
              <Avatar name={profile.business_name || profile.username || 'Business'} size={96} ring src={profile.avatar_url} />
              {profile.verified && (
                <span
                  className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full flex items-center justify-center border-4 border-white shadow-sm"
                  style={{ background: '#0095F6', color: '#FFFFFF' }}
                  role="img"
                  aria-label="Verified by Commissioner"
                  title="Verified by Commissioner"
                >
                  <Check size={14} strokeWidth={3.2} />
                </span>
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2 flex-wrap"><h1 className="cm-display font-bold text-2xl md:text-3xl" style={{ color: '#111827' }}>{profile.business_name || profile.username || 'Business'}</h1></div>
              <p className="text-sm" style={{ color: '#6B7280' }}>{profile.username ? `@${profile.username.replace(/^@/, '')}` : ''}{profile.city ? ` · ${profile.city}` : ''}</p>
              <div className="mt-1.5"><RatingSummary userId={profile.auth_user_id} /></div>
            </div>
            {profile.auth_user_id && (
              <button onClick={() => setReportOpen(true)} className="ml-auto sm:ml-0 sm:mb-1 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
                <Flag size={13} /> Report
              </button>
            )}
          </div>
          {profile.industry && <span className="inline-flex text-xs font-semibold px-3 py-1.5 rounded-full mb-5" style={{ background: '#F3E8FF', color: '#7C3AED' }}>{profile.industry}</span>}
          {profile.bio && <p className="text-sm leading-7 mb-6" style={{ color: '#374151' }}>{profile.bio}</p>}
          <div className="mb-6"><VerificationDetails type="business" id={profile.id} /></div>
          <div className="flex flex-wrap gap-3">
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl text-white" style={{ background: '#111827' }}><Globe size={15} /> Website <ArrowUpRight size={15} /></a>}
          </div>
          {profile.auth_user_id && (
            <div className="mt-8 pt-7 border-t" style={{ borderColor: '#E5E7EB' }}>
              <LeaveReviewBox targetUserId={profile.auth_user_id} session={session} onSaved={() => setReviewRefresh(k => k + 1)} />
              <ReviewsList userId={profile.auth_user_id} refreshKey={reviewRefresh} />
            </div>
          )}
        </div>
      </div>
      <div className="text-center mt-5 text-xs" style={{ color: '#9CA3AF' }}>Verified business profile powered by Commissioner</div>
    </div>
    {reportOpen && profile.auth_user_id && <ReportModal targetUserId={profile.auth_user_id} onClose={() => setReportOpen(false)} />}
  </div>
  );
};

const OfficialBusinessPage = ({ id, session }) => {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    supabase.from('business_profiles').select('id, auth_user_id, business_name, username, avatar_url, banner_url, city, bio, verified, industry, website, approved, onboarded').eq('id', id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [id]);
  if (!profile) return <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading business profile…</div>;
  return <PublicBusinessProfile profile={profile} session={session} />;
};

// Official creator pages use a stable profile ID. The NFC card points here, so the
// physical tag never needs to be rewritten when the creator edits their profile.
const OfficialCreatorPage = ({ id, session, setPage }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('creator_profiles')
      .select('id, auth_user_id, page_name, username, avatar_url, banner_url, city, language, bio, verified, primary_niche, availability, platforms, services, portfolio_link, approved, onboarded')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) {
      setProfile(data);
      setOwner(Boolean(session?.user?.id && data.auth_user_id === session.user.id));
      if (data.approved && data.onboarded) {
        supabase.rpc('track_profile_event', { p_creator_profile_id: id, p_event_type: 'profile_view' }).catch(() => {});
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadProfile(); }, [id, session?.user?.id]);

  if (loading) return <div className="max-w-2xl mx-auto px-5 md:px-8 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading creator profile…</div>;
  if (!profile) return <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center"><p className="text-sm font-semibold" style={{ color: '#111827' }}>Creator profile not found</p></div>;

  if (editMode && owner) {
    return (
      <div>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pt-6">
          <button onClick={() => setEditMode(false)} className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg border" style={{ borderColor:'#E5E7EB', color:'#374151' }}><ChevronLeft size={15}/> Back to profile</button>
        </div>
        <Onboarding session={session} setPage={setPage} editMode={true} onSaved={async () => { setEditMode(false); await loadProfile(); }} />
      </div>
    );
  }

  return (
    <>
      {!profile.onboarded && (
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-3"><div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>This creator is still completing their profile. The NFC card is already linked to this permanent creator page.</div></div>
      )}
      <PublicCreatorProfile
        profile={profile}
        canEdit={owner}
        session={session}
        setPage={setPage}
        onEdit={() => {
          if (!session?.user?.id) {
            const returnTo = `/creator/${encodeURIComponent(id)}`;
            window.location.href = `/?auth=1&returnTo=${encodeURIComponent(returnTo)}`;
            return;
          }
          setEditMode(true);
        }}
      />
    </>
  );
};

// NFC links are permanent: before a profile is claimed they open the claim form;
// once approved, the exact same NFC URL opens the public profile.
const ClaimGate = ({ token, session, setPage }) => {
  const [state, setState] = useState({ kind: null, profile: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_claim_any', { p_token: token });
      if (cancelled) return;

      if (error) {
        setState({ kind: 'error', profile: null, error: error.message || 'NFC lookup failed' });
        return;
      }

      if (!data?.kind) {
        setState({ kind: 'not_found', profile: null, error: '' });
        return;
      }

      // The RPC is security-definer and deliberately handles both claimable
      // and published rows. This keeps the physical NFC URL permanent.
      if (data.status === 'published') {
        if (data.kind === 'creator') setState({ kind: 'public_creator', profile: data, error: '' });
        else setState({ kind: 'public_business', profile: data, error: '' });
      } else {
        setState({ kind: data.kind, profile: data, error: '' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (state.kind === null) return <div className="max-w-2xl mx-auto px-5 md:px-8 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading NFC profile…</div>;
  if (state.kind === 'public_creator') return <OfficialCreatorPage id={state.profile.id} session={session} setPage={setPage} />;
  if (state.kind === 'public_business') return <PublicBusinessProfile profile={state.profile} />;
  if (state.kind === 'not_found') return <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center"><p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>This Commissioner card isn't available</p><p className="text-xs" style={{ color: '#6B7280' }}>The NFC token was not found. The physical card URL is valid, but its page may have been deleted or the token was never installed in this Supabase project.</p></div>;
  if (state.kind === 'error') return <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center"><p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>NFC setup needs attention</p><p className="text-xs" style={{ color: '#6B7280' }}>The card reached Commissioner, but the Supabase NFC lookup function is unavailable. Run the latest supabase-schema.sql migration, then try again.</p></div>;
  return state.kind === 'business' ? <BusinessClaimForm token={token} /> : <CreatorClaimForm token={token} />;
};



/* ========================= Commissioner trust + marketplace ========================= */

const TrustChip = ({ children, tone='cyan' }) => {
  const tones={green:['#E9FBEF','#0E7A3B'],cyan:['#E0FBFF','#036377'],amber:['#FFF7E6','#9A4A0C'],gray:['#F3F4F6','#4B5563']};
  const [bg,fg]=tones[tone]||tones.cyan;
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{background:bg,color:fg}}><CheckCircle2 size={12}/>{children}</span>;
};

const VerificationDetails = ({ type, id, compact=false }) => {
  const [claim,setClaim]=useState(null);
  useEffect(()=>{
    if(!id) return;
    const fn=type==='creator'?'get_creator_verification_summary':'get_business_verification_summary';
    const key=type==='creator'?'p_creator_profile_id':'p_business_profile_id';
    supabase.rpc(fn,{[key]:id}).then(({data})=>setClaim(Array.isArray(data)?(data[0]||null):(data||null)));
  },[type,id]);
  if(type==='creator') return <div className={compact?'':'border rounded-2xl p-5'} style={compact?{}:{borderColor:'#E5E7EB',background:'#FFFFFF'}}>
    {!compact&&<div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Creator verification</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Commissioner verifies specific claims instead of giving a blanket safety score.</p></div><Shield size={18} style={{color:'#036377'}}/></div>}
    <div className="flex flex-wrap gap-2">
      <TrustChip tone={claim?.identity_status==='verified'?'green':'gray'}>{claim?.identity_status==='verified'?'Identity checked':'Identity not checked'}</TrustChip>
      <TrustChip tone={claim?.account_status==='verified'?'green':'gray'}>{claim?.account_status==='verified'?'Account ownership checked':'Account ownership pending'}</TrustChip>
      <TrustChip tone={claim?.followers_status==='verified'?'green':'gray'}>{claim?.followers_status==='verified'?'Followers checked':'Follower count not verified'}</TrustChip>
      <TrustChip tone={claim?.engagement_status==='verified'?'green':'gray'}>{claim?.engagement_status==='verified'?'Engagement checked':'Engagement not verified'}</TrustChip>
    </div>
    {claim?.checked_at&&<p className="text-[10px] mt-3" style={{color:'#9CA3AF'}}>Last checked {new Date(claim.checked_at).toLocaleDateString()}</p>}
  </div>;
  return <div className={compact?'':'border rounded-2xl p-5'} style={compact?{}:{borderColor:'#E5E7EB',background:'#FFFFFF'}}>
    {!compact&&<div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Business verification</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Registration and licensing are checked separately from general reputation.</p></div><Building2 size={18} style={{color:'#7C3AED'}}/></div>}
    <div className="flex flex-wrap gap-2">
      <TrustChip tone={claim?.registration_status==='verified'?'green':'gray'}>{claim?.registration_status==='verified'?'Registration checked':'Registration not verified'}</TrustChip>
      <TrustChip tone={claim?.license_status==='verified'?'green':'gray'}>{claim?.license_status==='verified'?'License checked':'License pending'}</TrustChip>
      <TrustChip tone={claim?.representative_status==='verified'?'green':'gray'}>{claim?.representative_status==='verified'?'Representative checked':'Representative pending'}</TrustChip>
    </div>
    {claim?.checked_at&&<p className="text-[10px] mt-3" style={{color:'#9CA3AF'}}>Last checked {new Date(claim.checked_at).toLocaleDateString()}</p>}
  </div>;
};
const Businesses = ({ onConnect }) => {
  const [items,setItems]=useState([]); const [search,setSearch]=useState(''); const [category,setCategory]=useState('All'); const [loading,setLoading]=useState(true);
  useEffect(()=>{supabase.from('business_profiles').select('id,auth_user_id,business_name,username,avatar_url,city,bio,industry,website,verified,approved,onboarded').eq('approved',true).eq('onboarded',true).order('created_at',{ascending:false}).limit(60).then(({data})=>{setItems(data||[]);setLoading(false)})},[]);
  const filtered=items.filter(b=>(category==='All'||b.industry===category)&&`${b.business_name} ${b.industry} ${b.city} ${b.bio}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-wider" style={{color:'#7C3AED'}}>Business network</p><h1 className="cm-display font-bold text-2xl md:text-3xl mt-1" style={{color:'#111827'}}>Discover businesses</h1><p className="text-sm mt-2" style={{color:'#6B7280'}}>Find registered and Commissioner-verified businesses, then decide who you want to work with.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 mb-6"><div className="flex items-center gap-2 border rounded-xl px-3.5 py-3 bg-white" style={{borderColor:'#E5E7EB'}}><Search size={16} style={{color:'#9CA3AF'}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search business, industry, city…" className="flex-1 outline-none text-sm"/></div><select value={category} onChange={e=>setCategory(e.target.value)} className="border rounded-xl px-3 py-3 text-sm bg-white" style={{borderColor:'#E5E7EB'}}><option>All</option>{BUSINESS_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
    {loading?<p className="py-16 text-center text-sm" style={{color:'#6B7280'}}>Loading businesses…</p>:<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((b,i)=><div key={b.id} className="bg-white border rounded-2xl p-5 cm-card-hover" style={{borderColor:'#E5E7EB'}}><div className="flex items-start gap-3"><Avatar name={b.business_name} size={50} tone={i} src={b.avatar_url}/><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 flex-wrap"><h3 className="cm-display font-bold text-base truncate" style={{color:'#111827'}}>{b.business_name}</h3>{b.verified&&<VerifiedIcon size={14}/>}</div><p className="text-xs" style={{color:'#6B7280'}}>{b.industry||'Business'}{b.city?` · ${b.city}`:''}</p></div></div><p className="text-xs leading-6 mt-4 min-h-[48px]" style={{color:'#4B5563'}}>{b.bio||'Business profile on Commissioner.'}</p><VerificationDetails type="business" id={b.id} compact/><div className="flex gap-2 mt-4"><button onClick={()=>onConnect?.(b)} className="flex-1 text-sm font-semibold px-3 py-2.5 rounded-lg text-white" style={{background:'#111827'}}>Connect</button>{b.website&&<a href={b.website} target="_blank" rel="noreferrer" className="px-3 py-2.5 rounded-lg border" style={{borderColor:'#E5E7EB'}}><ArrowUpRight size={15}/></a>}</div></div>)}</div>}
    {!loading&&!filtered.length&&<div className="bg-white border rounded-2xl p-12 text-center" style={{borderColor:'#E5E7EB'}}><Building2 size={28} className="mx-auto mb-3" style={{color:'#D1D5DB'}}/><p className="text-sm font-semibold" style={{color:'#111827'}}>No businesses found</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Try another category or search.</p></div>}
  </div>;
};

const Marketplace = ({ onMessage }) => {
  const [tab,setTab]=useState('all'); const [q,setQ]=useState(''); const [items,setItems]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    (async()=>{
      const {data: listings}=await supabase.from('marketplace_listings').select('*').eq('active',true).order('created_at',{ascending:false}).limit(100);
      const [{data: creators},{data: businesses}]=await Promise.all([
        supabase.from('creator_profiles').select('id,page_name,username,avatar_url,city,primary_niche,verified,approved,onboarded').eq('approved',true).eq('onboarded',true).limit(80),
        supabase.from('business_profiles').select('id,business_name,username,avatar_url,city,industry,verified,approved,onboarded').eq('approved',true).eq('onboarded',true).limit(80)
      ]);
      const byId={}; (creators||[]).forEach(x=>byId[`creator:${x.id}`]={...x,type:'creator'}); (businesses||[]).forEach(x=>byId[`business:${x.id}`]={...x,type:'business'});
      const rows=(listings||[]).map(x=>({...x,owner:byId[`${x.owner_type}:${x.owner_id}`]})).filter(x=>x.owner);
      // Existing creator_products are also surfaced so the marketplace is useful immediately after the previous migration.
      const {data: products}=await supabase.from('creator_products').select('*').eq('active',true).limit(80);
      (products||[]).forEach(p=>{const owner=byId[`creator:${p.creator_profile_id}`]; if(owner) rows.push({id:`product-${p.id}`,owner_type:'creator',owner_id:p.creator_profile_id,title:p.name,description:p.description,listing_type:p.type,price_display:p.price!=null?`${Number(p.price).toLocaleString()} ${p.currency}`:'Contact',external_url:p.purchase_url,owner});});
      setItems(rows); setLoading(false);
    })();
  },[]);
  const filtered=items.filter(x=>(tab==='all'||x.owner_type===tab||x.listing_type===tab)&&`${x.title} ${x.description} ${x.category} ${x.owner?.page_name||x.owner?.business_name||''}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="max-w-7xl mx-auto px-5 md:px-8 py-10"><div className="mb-7"><p className="text-xs font-bold uppercase tracking-wider" style={{color:'#E6007A'}}>Commissioner marketplace</p><h1 className="cm-display font-bold text-2xl md:text-3xl mt-1" style={{color:'#111827'}}>Products, services & collaborations</h1><p className="text-sm mt-2" style={{color:'#6B7280'}}>Discover offers from verified creators and businesses. Commissioner connects you; transactions happen directly between parties.</p></div><div className="flex flex-col md:flex-row gap-3 mb-6"><div className="flex items-center gap-2 border rounded-xl px-3.5 py-3 bg-white flex-1" style={{borderColor:'#E5E7EB'}}><Search size={16} style={{color:'#9CA3AF'}}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products, services, creators, businesses…" className="flex-1 outline-none text-sm"/></div><div className="flex gap-1 bg-white border rounded-xl p-1" style={{borderColor:'#E5E7EB'}}>{[['all','All'],['creator','Creators'],['business','Businesses'],['product','Products'],['service','Services']].map(([v,l])=><button key={v} onClick={()=>setTab(v)} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{background:tab===v?'#111827':'transparent',color:tab===v?'#fff':'#4B5563'}}>{l}</button>)}</div></div>{loading?<p className="py-16 text-center text-sm" style={{color:'#6B7280'}}>Loading marketplace…</p>:<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((x,i)=><div key={x.id} className="bg-white border rounded-2xl p-5 cm-card-hover" style={{borderColor:'#E5E7EB'}}><div className="flex items-center gap-3 mb-4"><Avatar name={x.owner?.page_name||x.owner?.business_name} size={42} tone={i} src={x.owner?.avatar_url}/><div className="min-w-0"><div className="flex items-center gap-1"><p className="text-sm font-semibold truncate" style={{color:'#111827'}}>{x.owner?.page_name||x.owner?.business_name}</p>{x.owner?.verified&&<VerifiedIcon size={12}/>}</div><p className="text-[11px]" style={{color:'#6B7280'}}>{x.owner_type==='creator'?'Creator':'Business'} · {x.owner?.city||'—'}</p></div></div><span className="text-[10px] font-bold uppercase tracking-wide" style={{color:'#E6007A'}}>{x.listing_type}</span><h3 className="cm-display font-bold text-base mt-1" style={{color:'#111827'}}>{x.title}</h3><p className="text-xs leading-6 mt-2 h-12 overflow-hidden" style={{color:'#4B5563'}}>{x.description||'No description provided.'}</p>{x.price_display&&<p className="text-sm font-bold mt-3" style={{color:'#111827'}}>{x.price_display}</p>}<div className="flex gap-2 mt-4"><button onClick={()=>onMessage?.(x.owner)} className="flex-1 text-sm font-semibold px-3 py-2.5 rounded-lg text-white" style={{background:'#E6007A'}}>Contact</button>{x.external_url&&<a href={x.external_url} target="_blank" rel="noreferrer" className="px-3 py-2.5 rounded-lg border" style={{borderColor:'#E5E7EB'}}><ArrowUpRight size={15}/></a>}</div></div>)}</div>}{!loading&&!filtered.length&&<div className="bg-white border rounded-2xl p-12 text-center" style={{borderColor:'#E5E7EB'}}><ShoppingBag size={28} className="mx-auto mb-3" style={{color:'#D1D5DB'}}/><p className="text-sm font-semibold" style={{color:'#111827'}}>Nothing matches yet</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Creators and businesses can publish products and services from their dashboards.</p></div>}</div>;
};

const TrustCenter = ({ session }) => {
  const [profile,setProfile]=useState(null); const [type,setType]=useState('creator'); const [claim,setClaim]=useState(null); const [note,setNote]=useState(''); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState('');
  const load=async()=>{
    if(!session?.user?.id)return;
    const {data:c}=await supabase.from('creator_profiles').select('*').eq('auth_user_id',session.user.id).maybeSingle();
    if(c){setType('creator');setProfile(c);const {data:v}=await supabase.from('creator_verification_claims').select('*').eq('creator_profile_id',c.id).maybeSingle();setClaim(v||null);return;}
    const {data:b}=await supabase.from('business_profiles').select('*').eq('auth_user_id',session.user.id).maybeSingle();
    if(b){setType('business');setProfile(b);const {data:v}=await supabase.from('business_verification_claims').select('*').eq('business_profile_id',b.id).maybeSingle();setClaim(v||null);}
  };
  useEffect(()=>{load()},[session?.user?.id]);
  const submit=async()=>{if(!profile)return;setBusy(true);setMsg('');const fn=type==='creator'?'submit_creator_verification':'submit_business_verification';const params=type==='creator'?{p_creator_profile_id:profile.id,p_evidence_note:note}:{p_business_profile_id:profile.id,p_evidence_note:note};const {error}=await supabase.rpc(fn,params);setBusy(false);if(error)setMsg(error.message);else{setMsg('Verification request submitted. An administrator will review the specific claims.');await load();}};
  if(!session)return <div className="max-w-xl mx-auto px-5 py-20 text-center"><Shield size={32} className="mx-auto mb-3" style={{color:'#036377'}}/><h1 className="cm-display font-bold text-2xl" style={{color:'#111827'}}>Trust & verification</h1><p className="text-sm mt-2" style={{color:'#6B7280'}}>Sign in to request verification.</p></div>;
  return <div className="max-w-4xl mx-auto px-5 md:px-8 py-10"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-wider" style={{color:'#036377'}}>Trust center</p><h1 className="cm-display font-bold text-2xl md:text-3xl mt-1" style={{color:'#111827'}}>Verify what you claim</h1><p className="text-sm mt-2 max-w-2xl" style={{color:'#6B7280'}}>Commissioner does not give a blanket “safe” score. We verify specific facts so other people can make informed decisions.</p></div><div className="bg-white border rounded-2xl p-6 mb-5" style={{borderColor:'#E5E7EB'}}><div className="flex items-center gap-3 mb-5"><Avatar name={profile?.page_name||profile?.business_name||session.user.email} size={52} src={profile?.avatar_url}/><div><div className="flex items-center gap-2"><h2 className="cm-display font-bold" style={{color:'#111827'}}>{profile?.page_name||profile?.business_name||'Your profile'}</h2>{profile?.verified&&<VerifiedIcon size={15}/>}</div><p className="text-xs" style={{color:'#6B7280'}}>{type==='creator'?'Creator':'Business'} · {profile?.city||'Location not set'}</p></div></div><VerificationDetails type={type} id={profile?.id}/></div><div className="bg-white border rounded-2xl p-6" style={{borderColor:'#E5E7EB'}}><h2 className="text-sm font-semibold" style={{color:'#111827'}}>Request a verification review</h2><p className="text-xs mt-1 mb-4" style={{color:'#6B7280'}}>{type==='creator'?'We can review identity, linked-account ownership, follower count and engagement claims.':'We can review your registered business information, license and authorized representative.'}</p><textarea value={note} onChange={e=>setNote(e.target.value)} rows={4} placeholder={type==='creator'?'Tell the reviewer which connected accounts and statistics you want checked.':'Add the business registration/license reference or instructions for the reviewer. Do not paste private passwords or payment information.'} className="w-full border rounded-xl px-3 py-3 text-sm outline-none resize-none" style={{borderColor:'#E5E7EB'}}/><div className="flex items-center justify-between mt-4"><span className="text-xs" style={{color:claim?.status==='verified'?'#0E7A3B':'#6B7280'}}>{claim?`Current review: ${claim.status.replace('_',' ')}`:'No review submitted yet'}</span><button disabled={busy} onClick={submit} className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-50" style={{background:'#111827'}}>{busy?'Submitting…':'Request review'}</button></div>{msg&&<p className="text-xs mt-3" style={{color:msg.includes('submitted')?'#0E7A3B':'#B42318'}}>{msg}</p>}</div></div>;
};

const B2BNetwork = ({ session, initialBusiness=null }) => {
  const [items,setItems]=useState([]); const [connections,setConnections]=useState([]); const [search,setSearch]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const load=async()=>{if(!session)return;const [{data:bs},{data:cs}]=await Promise.all([supabase.from('business_profiles').select('id,auth_user_id,business_name,username,avatar_url,industry,city,verified,approved,onboarded').eq('approved',true).eq('onboarded',true).limit(50),supabase.from('creator_profiles').select('id,auth_user_id,page_name,username,avatar_url,primary_niche,city,verified,approved,onboarded').eq('approved',true).eq('onboarded',true).limit(50)]);setItems([...(bs||[]).map(x=>({...x,kind:'business',name:x.business_name})),...(cs||[]).map(x=>({...x,kind:'creator',name:x.page_name}))].filter(x=>x.auth_user_id!==session.user.id));const {data:c}=await supabase.from('b2b_connections').select('*').or(`requester_user_id.eq.${session.user.id},recipient_user_id.eq.${session.user.id}`).order('created_at',{ascending:false});setConnections(c||[])};
  useEffect(()=>{load()},[session?.user?.id]);
  useEffect(()=>{if(initialBusiness&&session)setMessage(`I'd like to connect with ${initialBusiness.business_name||initialBusiness.name} through Commissioner.`)},[initialBusiness?.id,session?.user?.id]);
  const send=async(target)=>{if(!session)return;setBusy(true);const {error}=await supabase.from('b2b_connections').insert({requester_user_id:session.user.id,recipient_user_id:target.auth_user_id,message:message.trim()||'I would like to connect professionally through Commissioner.'});setBusy(false);if(error)setMessage(error.code==='23505'?'A connection request already exists.':error.message);else{setMessage('Connection request sent.');await load();}};
  const filtered=items.filter(x=>`${x.name} ${x.industry||x.primary_niche||''} ${x.city||''}`.toLowerCase().includes(search.toLowerCase()));
  if(!session)return <div className="max-w-xl mx-auto px-5 py-20 text-center"><Briefcase size={32} className="mx-auto mb-3" style={{color:'#E6007A'}}/><h1 className="cm-display font-bold text-2xl" style={{color:'#111827'}}>B2B network</h1><p className="text-sm mt-2" style={{color:'#6B7280'}}>Sign in to connect with businesses and creators.</p></div>;
  return <div className="max-w-7xl mx-auto px-5 md:px-8 py-10"><div className="mb-7"><p className="text-xs font-bold uppercase tracking-wider" style={{color:'#E6007A'}}>B2B network</p><h1 className="cm-display font-bold text-2xl md:text-3xl mt-1" style={{color:'#111827'}}>Professional connections without the noise</h1><p className="text-sm mt-2" style={{color:'#6B7280'}}>Find people and companies, review their verified facts, and start a professional relationship.</p></div><div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5"><div><div className="flex items-center gap-2 border rounded-xl px-3.5 py-3 bg-white mb-4" style={{borderColor:'#E5E7EB'}}><Search size={16} style={{color:'#9CA3AF'}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies, creators, industries…" className="flex-1 outline-none text-sm"/></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map((x,i)=><div key={x.kind+x.id} className="bg-white border rounded-2xl p-5" style={{borderColor:'#E5E7EB'}}><div className="flex items-center gap-3"><Avatar name={x.name} size={46} tone={i} src={x.avatar_url}/><div className="min-w-0 flex-1"><div className="flex items-center gap-1"><p className="text-sm font-semibold truncate" style={{color:'#111827'}}>{x.name}</p>{x.verified&&<VerifiedIcon size={12}/>}</div><p className="text-[11px]" style={{color:'#6B7280'}}>{x.kind==='business'?x.industry:x.primary_niche}{x.city?` · ${x.city}`:''}</p></div></div><p className="text-[11px] mt-4" style={{color:'#6B7280'}}>Verified facts are shown separately from general reputation.</p><div className="flex gap-2 mt-3"><button onClick={()=>send(x)} disabled={busy} className="flex-1 text-xs font-semibold px-3 py-2.5 rounded-lg text-white disabled:opacity-50" style={{background:'#111827'}}>Connect</button><button onClick={()=>setMessage(`I'd like to discuss a professional opportunity with ${x.name}.`)} className="px-3 py-2.5 rounded-lg border" style={{borderColor:'#E5E7EB'}}><MessageSquare size={14}/></button></div></div>)}</div></div><aside className="bg-white border rounded-2xl p-5 h-fit" style={{borderColor:'#E5E7EB'}}><p className="text-sm font-semibold" style={{color:'#111827'}}>Connection message</p><p className="text-xs mt-1 mb-3" style={{color:'#6B7280'}}>This starts a professional connection. You can continue the conversation in Messages after acceptance.</p><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5} className="w-full border rounded-xl px-3 py-3 text-xs outline-none resize-none" style={{borderColor:'#E5E7EB'}} placeholder="Introduce yourself and explain why you want to connect."/><div className="mt-4 border-t pt-4" style={{borderColor:'#F3F4F6'}}><p className="text-xs font-semibold mb-2" style={{color:'#111827'}}>Your recent connections</p>{connections.slice(0,5).map(c=><div key={c.id} className="flex items-center justify-between py-2 text-[11px]"><span style={{color:'#4B5563'}}>{c.requester_user_id===session.user.id?'You sent':'Incoming request'}</span><span className="font-semibold" style={{color:c.status==='accepted'?'#0E7A3B':'#9A4A0C'}}>{c.status}</span></div>)}{!connections.length&&<p className="text-[11px]" style={{color:'#9CA3AF'}}>No connections yet.</p>}</div></aside></div></div>;
};

const VerificationAdminQueue = () => {
  const [creators,setCreators]=useState([]); const [businesses,setBusinesses]=useState([]); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState('');
  const load=async()=>{setLoading(true);const [{data:c},{data:b}]=await Promise.all([supabase.from('creator_verification_claims').select('*,creator_profiles(id,page_name,username,platforms,audience,verified)').order('created_at',{ascending:false}),supabase.from('business_verification_claims').select('*,business_profiles(id,business_name,username,industry,verified)').order('created_at',{ascending:false})]);setCreators(c||[]);setBusinesses(b||[]);setLoading(false)};
  useEffect(()=>{load()},[]);
  const verifyField=async(type,row,field)=>{
    setBusy(`${row.id}:${field}`); const table=type==='creator'?'creator_verification_claims':'business_verification_claims';
    const patch={ [field]:'verified', checked_at:new Date().toISOString(), status:'pending' };
    const next={identity_status:row.identity_status,account_status:row.account_status,followers_status:row.followers_status,engagement_status:row.engagement_status,registration_status:row.registration_status,license_status:row.license_status,representative_status:row.representative_status,...patch};
    const required=type==='creator'?['followers_status','engagement_status']:['registration_status','license_status'];
    if(required.every(k=>next[k]==='verified')) patch.status='verified';
    const {error}=await supabase.from(table).update(patch).eq('id',row.id);
    if(!error && patch.status==='verified'){const ptype=type==='creator'?'creator_profiles':'business_profiles';const pid=type==='creator'?row.creator_profile_id:row.business_profile_id;await supabase.from(ptype).update({verified:true}).eq('id',pid)}
    setBusy(''); await load();
  };
  const reject=async(type,row)=>{setBusy(row.id);const table=type==='creator'?'creator_verification_claims':'business_verification_claims';await supabase.from(table).update({status:'rejected'}).eq('id',row.id);setBusy('');await load()};
  if(loading)return <div className="border rounded-2xl p-5 mb-8" style={{borderColor:'#E5E7EB'}}><p className="text-sm" style={{color:'#6B7280'}}>Loading verification queue…</p></div>;
  const rows=[...creators.map(x=>({...x,_type:'creator',name:x.creator_profiles?.page_name||x.creator_profiles?.username||'Creator'})),...businesses.map(x=>({...x,_type:'business',name:x.business_profiles?.business_name||x.business_profiles?.username||'Business'}))];
  return <div className="border rounded-2xl p-5 mb-8" style={{borderColor:'#E5E7EB',background:'#FFFFFF'}}><div className="flex items-center justify-between mb-4"><div><p className="text-sm font-semibold" style={{color:'#111827'}}>Verification queue</p><p className="text-xs mt-1" style={{color:'#6B7280'}}>Verify the exact claims you checked. A badge is not a guarantee of safety.</p></div><Shield size={18} style={{color:'#036377'}}/></div><div className="space-y-3">{rows.map(r=><div key={r.id} className="border rounded-xl p-4" style={{borderColor:'#E5E7EB'}}><div className="flex flex-col gap-3"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold" style={{color:'#111827'}}>{r.name}</p><span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full" style={{background:r._type==='creator'?'#FDE7F1':'#F3E8FF',color:r._type==='creator'?'#99154F':'#7C3AED'}}>{r._type}</span></div><p className="text-[11px] mt-1" style={{color:'#6B7280'}}>Review status: {r.status}</p></div><button disabled={busy===r.id} onClick={()=>reject(r._type,r)} className="text-xs font-semibold px-3 py-2 rounded-lg border disabled:opacity-50" style={{borderColor:'#FECACA',color:'#B42318'}}>Reject</button></div>{r._type==='creator'?<div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[['identity_status','Identity'],['account_status','Account'],['followers_status','Followers'],['engagement_status','Engagement']].map(([f,l])=><button key={f} disabled={r[f]==='verified'||busy===`${r.id}:${f}`} onClick={()=>verifyField(r._type,r,f)} className="text-left border rounded-lg p-3 disabled:opacity-60" style={{borderColor:r[f]==='verified'?'#BBF7D0':'#E5E7EB',background:r[f]==='verified'?'#F0FDF4':'#FFFFFF'}}><p className="text-[11px] font-semibold" style={{color:'#374151'}}>{l}</p><p className="text-[10px] mt-1 font-bold" style={{color:r[f]==='verified'?'#0E7A3B':'#9CA3AF'}}>{r[f]==='verified'?'Verified':'Verify claim'}</p></button>)}</div>:<div className="grid grid-cols-1 md:grid-cols-3 gap-2">{[['registration_status','Registration'],['license_status','License'],['representative_status','Representative']].map(([f,l])=><button key={f} disabled={r[f]==='verified'||busy===`${r.id}:${f}`} onClick={()=>verifyField(r._type,r,f)} className="text-left border rounded-lg p-3 disabled:opacity-60" style={{borderColor:r[f]==='verified'?'#BBF7D0':'#E5E7EB',background:r[f]==='verified'?'#F0FDF4':'#FFFFFF'}}><p className="text-[11px] font-semibold" style={{color:'#374151'}}>{l}</p><p className="text-[10px] mt-1 font-bold" style={{color:r[f]==='verified'?'#0E7A3B':'#9CA3AF'}}>{r[f]==='verified'?'Verified':'Verify claim'}</p></button>)}</div>}</div></div>)}{!rows.length&&<p className="text-xs py-5 text-center" style={{color:'#9CA3AF'}}>No verification requests yet.</p>}</div></div>;
};
const AdminPanel = ({ session }) => {
  const [claimType, setClaimType] = useState('creator'); // 'creator' | 'business'
  const [pageName, setPageName] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState('');
  const [bio, setBio] = useState('');
  const [niche, setNiche] = useState(NICHES[0]);
  const [industry, setIndustry] = useState(BUSINESS_CATEGORIES[0]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [socials, setSocials] = useState({});
  const [audience, setAudience] = useState({ age: '', gender: '', location: '', avg_views: '', avg_reach: '' });
  const [pricing, setPricing] = useState({ tiktok: '', reel: '', story: '', youtube: '', monthly: '', ugc: '' });
  const [portfolioLink, setPortfolioLink] = useState('');
  const [availability, setAvailability] = useState('Available now');
  const [preferences, setPreferences] = useState('');
  const [verifiedOnCreate, setVerifiedOnCreate] = useState(true);
  const [giftMode, setGiftMode] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newLink, setNewLink] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [nfcWriting, setNfcWriting] = useState(false);
  const [nfcMessage, setNfcMessage] = useState('');
  const [setupStatus, setSetupStatus] = useState('checking');
  const [setupError, setSetupError] = useState('');

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  useEffect(() => {
    if (!session) { setIsAdmin(false); setAdminChecked(true); return; }
    supabase.rpc('is_admin').then(({ data }) => { setIsAdmin(!!data); setAdminChecked(true); });
  }, [session?.user?.id]);

  const loadRows = async () => {
    setLoadingRows(true);
    const [{ data: creators }, { data: businesses }] = await Promise.all([
      supabase.from('creator_profiles').select('id, page_name, username, city, bio, primary_niche, verified, approved, onboarded, claimed, claim_token, created_at'),
      supabase.from('business_profiles').select('id, business_name, username, city, bio, industry, verified, approved, onboarded, claimed, claim_token, created_at'),
    ]);
    const tagged = [
      ...(creators || []).map(r => ({ ...r, kind: 'creator', displayName: r.page_name, displayTag: r.primary_niche })),
      ...(businesses || []).map(r => ({ ...r, kind: 'business', displayName: r.business_name, displayTag: r.industry })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setRows(tagged);
    setLoadingRows(false);
  };

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    const checkSetup = async () => {
      setSetupStatus('checking');
      setSetupError('');
      const { data, error } = await supabase.rpc('admin_check_setup');
      if (cancelled) return;

      if (error) {
        const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '');
        setSetupStatus('missing');
        setSetupError(
          missing
            ? 'The Supabase admin migration has not been applied. The Admin page cannot create gift profiles until admin_check_setup and the admin_create_claim functions are installed.'
            : `Supabase setup check failed: ${error.message}`
        );
        return;
      }

      setSetupStatus(data?.ready ? 'ready' : 'missing');
      if (!data?.ready) {
        setSetupError('The Supabase admin migration is incomplete. Apply the latest supabase-schema.sql, then refresh this page.');
      }
    };

    checkSetup();
    loadRows();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const updateSocial = (platform, field, value) => setSocials(prev => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));
  const handleAdminImage = (file, kind) => {
    if (!file) return;
    if (kind === 'avatar') { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
    else { setBannerFile(file); setBannerPreview(URL.createObjectURL(file)); }
  };
  const uploadAdminImage = async (file, bucket, token) => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `claim/${token}/admin-${bucket}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const resetBuilder = () => {
    setPageName(''); setUsername(''); setLocation(''); setLanguage(''); setBio('');
    setAvatarFile(null); setAvatarPreview(''); setBannerFile(null); setBannerPreview('');
    setSocials({}); setAudience({ age: '', gender: '', location: '', avg_views: '', avg_reach: '' });
    setPricing({ tiktok: '', reel: '', story: '', youtube: '', monthly: '', ugc: '' });
    setPortfolioLink(''); setAvailability('Available now'); setPreferences('');
  };

  const handleCreate = async () => {
    if (setupStatus !== 'ready') {
      setCreateError('Admin setup is not ready. Apply the latest Supabase migration shown above, then refresh the page.');
      return;
    }
    // A gift card may intentionally start blank. The recipient fills the
    // profile after tapping the NFC card.
    const effectiveName = pageName.trim() || (giftMode ? 'Gifted profile' : '');
    if (!effectiveName) { setCreateError('Enter a name first.'); return; }
    setCreating(true);
    setCreateError('');
    setNewLink('');
    setSetupLink('');
    setNfcMessage('');

    const { data, error } = claimType === 'creator'
      ? await supabase.rpc('admin_create_claim', {
          p_page_name: effectiveName,
          p_primary_niche: giftMode ? null : niche,
          p_verified: verifiedOnCreate
        })
      : await supabase.rpc('admin_create_business_claim', {
          p_business_name: effectiveName,
          p_industry: giftMode ? null : industry,
          p_verified: verifiedOnCreate
        });

    setCreating(false);
    if (error) {
      const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '');
      setSetupStatus(missing ? 'missing' : setupStatus);
      setCreateError(
        missing
          ? 'The Supabase admin_create_claim function is missing. Apply the latest Supabase migration shown in the Admin setup panel, then refresh the page.'
          : error.message
      );
      return;
    }

    const token = data;
    try {
      const table = claimType === 'creator' ? 'creator_profiles' : 'business_profiles';
      const avatarUrl = claimType === 'creator' ? await uploadAdminImage(avatarFile, 'avatars', token) : null;
      const bannerUrl = await uploadAdminImage(bannerFile, 'banners', token);
      const update = claimType === 'creator'
        ? { page_name: effectiveName, username: username.trim() || null, city: location.trim() || null, language: language.trim() || null, bio: bio.trim() || null, primary_niche: giftMode ? null : niche, avatar_url: avatarUrl, banner_url: bannerUrl, platforms: socials, audience, services: pricing, portfolio_link: portfolioLink.trim() || null, availability, professional_preferences: preferences.trim() || null, onboarded: true }
        : { business_name: effectiveName, username: username.trim() || null, city: location.trim() || null, language: language.trim() || null, bio: bio.trim() || null, industry: giftMode ? null : industry, avatar_url: avatarUrl, banner_url: bannerUrl, onboarded: true };
      const { data: found, error: findError } = await supabase.from(table).select('id').eq('claim_token', token).single();
      if (findError) throw findError;
      const { error: updateError } = await supabase.from(table).update(update).eq('id', found.id);
      if (updateError) throw updateError;
    } catch (err) {
      setCreateError(`The page was created, but some profile details could not be saved: ${err.message}`);
    }
    const { data: createdRow, error: createdRowError } = await supabase
      .from(claimType === 'creator' ? 'creator_profiles' : 'business_profiles')
      .select('id')
      .eq('claim_token', token)
      .single();
    if (createdRowError || !createdRow) {
      setCreateError(createdRowError?.message || 'Page created, but its permanent profile URL could not be generated.');
      return;
    }
    const officialPath = claimType === 'creator' ? `/creator/${createdRow.id}` : `/business/${createdRow.id}`;
    const link = `${window.location.origin}${officialPath}`;
    const setup = `${window.location.origin}/?claim=${token}`;
    setNewLink(link);
    setSetupLink(setup);
    resetBuilder();
    loadRows();
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCreateError('Could not copy automatically. Select and copy the NFC URL manually.');
    }
  };

  const writeNfc = async (link) => {
    setNfcMessage('');
    if (!link) {
      setNfcMessage('Create a gift page first so there is an NFC URL to write.');
      return;
    }
    // Web NFC is not exposed by Safari/iOS, including iPhone 7 on iOS 15.
    // Do not pretend the browser can write the tag. Keep the button useful by
    // copying the permanent URL and giving a precise device instruction.
    if (!('NDEFReader' in window)) {
      try {
        await navigator.clipboard?.writeText(link);
      } catch {}
      setNfcMessage('This iPhone/browser cannot write NFC tags. The permanent NFC URL was copied if your browser allowed it. To write the NTAG215, use Chrome on an NFC-capable Android phone over HTTPS or a USB NFC writer on your PC.');
      return;
    }
    setNfcWriting(true);
    try {
      const ndef = new window.NDEFReader();
      await ndef.write({ records: [{ recordType: 'url', data: link }] });
      setNfcMessage('Success — the URL was written to the NFC tag. Tap the card with a phone to test it.');
    } catch (error) {
      setNfcMessage(error?.message || 'NFC write failed. Make sure NFC is enabled, the tag is close to the phone, and the tag is writable.');
    } finally {
      setNfcWriting(false);
    }
  };

  const toggleField = async (row, field) => {
    setBusyId(row.id + field);
    const table = row.kind === 'business' ? 'business_profiles' : 'creator_profiles';
    const { error } = await supabase.from(table).update({ [field]: !row[field] }).eq('id', row.id);
    setBusyId(null);
    if (error) {
      setCreateError(`Could not update ${field}: ${error.message}`);
      return;
    }
    loadRows();
  };

  const deletePage = async (row) => {
    const name = row.displayName || 'this page';
    const confirmed = window.confirm(`Delete ${name}?\n\nThis permanently deletes the gift/profile page and its claim link. This cannot be undone.`);
    if (!confirmed) return;

    setBusyId(row.id + 'delete');
    setCreateError('');
    const { data, error } = await supabase.rpc('admin_delete_page', {
      p_kind: row.kind,
      p_page_id: row.id
    });
    setBusyId(null);

    if (error) {
      const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '');
      setCreateError(
        missing
          ? 'The Supabase delete function is missing. Run the latest supabase-schema.sql in Supabase → SQL Editor, then refresh this page.'
          : `Could not delete ${name}: ${error.message}`
      );
      return;
    }

    if (!data?.deleted) {
      setCreateError(`Could not delete ${name}. The page may already have been deleted.`);
      return;
    }

    await loadRows();
  };

  const pending = rows.filter(r => r.onboarded && !r.approved);
  const live = rows.filter(r => r.onboarded && r.approved);
  const waiting = rows.filter(r => !r.onboarded);

  const KindTag = ({ kind }) => (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={kind === 'business' ? { background: '#F3E8FF', color: '#7C3AED' } : { background: '#FDE7F1', color: '#99154F' }}
    >
      {kind}
    </span>
  );

  const RowCard = ({ r }) => {
    const rowLink = r.id ? `${window.location.origin}/${r.kind === 'creator' ? 'creator' : 'business'}/${r.id}` : '';
    const rowSetupLink = r.claim_token ? `${window.location.origin}/?claim=${r.claim_token}` : '';
    return (
      <div className="bg-white border rounded-xl p-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#111827' }}>
              {r.displayName || <span style={{ color: '#9CA3AF' }}>Unnamed</span>}
              {r.verified && <VerifiedBadge />}
              <KindTag kind={r.kind} />
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {r.username ? `@${r.username}` : ''} {r.displayTag ? `· ${r.displayTag}` : ''} {r.city ? `· ${r.city}` : ''}
            </p>
          </div>
          {rowLink && (
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <button onClick={() => copyLink(rowLink)} className="text-[11px] font-semibold" style={{ color: '#036377' }}>
                {copied === rowLink ? 'Copied!' : 'Copy NFC link'}
              </button>
              <button onClick={() => writeNfc(rowLink)} disabled={nfcWriting} className="text-[11px] font-semibold disabled:opacity-50" style={{ color: '#99154F' }}>
                {nfcWriting ? 'Writing…' : 'Write NFC'}
              </button>
              {rowSetupLink && <button onClick={() => copyLink(rowSetupLink)} className="text-[11px] font-semibold" style={{ color: '#6B7280' }}>Copy setup link</button>}
            </div>
          )}
        </div>
        {r.bio && <p className="text-xs mb-3" style={{ color: '#374151' }}>{r.bio}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => deletePage(r)}
            disabled={busyId === r.id + 'delete'}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border disabled:opacity-50"
            style={{ background: '#FFF1F2', color: '#BE123C', borderColor: '#FDA4AF' }}
          >
            {busyId === r.id + 'delete' ? 'Deleting…' : 'Delete page'}
          </button>
          {r.onboarded && (
            <button
              onClick={() => toggleField(r, 'approved')}
              disabled={busyId === r.id + 'approved'}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border disabled:opacity-50"
              style={r.approved
                ? { background: '#E9FBEF', color: '#0E7A3B', borderColor: '#0E7A3B' }
                : { background: 'white', color: '#374151', borderColor: '#E5E7EB' }}
            >
              {r.approved ? 'Approved ✓' : 'Approve'}
            </button>
          )}
          <button
            onClick={() => toggleField(r, 'verified')}
            disabled={busyId === r.id + 'verified'}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border disabled:opacity-50"
            style={r.verified
              ? { background: '#E0FBFF', color: '#036377', borderColor: '#00D9FF' }
              : { background: 'white', color: '#374151', borderColor: '#E5E7EB' }}
          >
            {r.verified ? 'Verified ✓' : 'Mark verified'}
          </button>
        </div>
      </div>
    );
  };

  if (!adminChecked) {
    return <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Checking access…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-5 md:px-8 py-24 text-center">
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Not authorized</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>This page is only available to the site admin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="cm-display font-bold text-2xl" style={{ color: '#111827' }}>Admin</h1>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Create gift profiles, prepare NFC cards, and approve published profiles.</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full" style={{ background: '#E0FBFF', color: '#036377' }}>
          <Zap size={12} /> NTAG215 ready
        </span>
      </div>

      {setupStatus === 'checking' && (
        <div className="border rounded-2xl p-4 mb-6" style={{ borderColor: '#BAE6FD', background: '#F0F9FF' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full cm-live-dot" style={{ background: '#0284C7' }} />
            <p className="text-sm font-semibold" style={{ color: '#075985' }}>Checking Supabase admin setup…</p>
          </div>
          <p className="text-xs mt-1" style={{ color: '#0369A1' }}>The page is verifying that the gift-profile and NFC claim functions are installed.</p>
        </div>
      )}

      {setupStatus === 'missing' && (
        <div className="border rounded-2xl p-5 mb-6" style={{ borderColor: '#F59E0B', background: '#FFFBEB' }}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5" style={{ color: '#B45309' }}><Shield size={18} /></div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#92400E' }}>Supabase admin setup required</p>
              <p className="text-xs mt-1 leading-5" style={{ color: '#78350F' }}>{setupError}</p>
              <div className="mt-3 p-3 rounded-lg border cm-mono text-[11px] whitespace-pre-wrap overflow-auto" style={{ borderColor: '#FCD34D', background: '#FFFFFF', color: '#92400E' }}>
                Run the latest <b>supabase-schema.sql</b> in Supabase → SQL Editor.
                Then click Refresh / reload this page.

                Required functions:
                • public.admin_check_setup()
                • public.admin_create_claim(text, text, boolean)
                • public.admin_create_business_claim(text, text, boolean)
                • public.admin_delete_page(text, uuid)
              </div>
              <p className="text-[11px] mt-2" style={{ color: '#92400E' }}>No profile will be created while setup is incomplete.</p>
            </div>
          </div>
        </div>
      )}

      <VerificationAdminQueue />

      <div className="bg-white border rounded-2xl p-6 mb-8" style={{ borderColor: '#E5E7EB' }}>
        <div className="mb-4">
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Create a gift profile + NFC card</p>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Create an open-ended profile for anyone you want to gift. Leave the name empty and the recipient can fill in their own name, bio, socials, photo, and other details from the claim page.
          </p>
        </div>

        <div className="flex border rounded-lg p-1 mb-4 w-fit" style={{ borderColor: '#E5E7EB' }}>
          {['creator', 'business'].map(t => (
            <button
              key={t}
              onClick={() => { setClaimType(t); setNewLink(''); setCreateError(''); }}
              className="text-sm font-semibold px-4 py-1.5 rounded-md capitalize"
              style={{ background: claimType === t ? '#111827' : 'transparent', color: claimType === t ? 'white' : '#374151' }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setClaimType('creator'); setPageName(''); setNiche('Entertainment'); setGiftMode(true); setVerifiedOnCreate(true); setNewLink(''); setCreateError(''); }}
            className="text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-1.5"
            style={{ borderColor: '#E6007A', color: '#99154F', background: '#FDE7F1' }}
          >
            <Award size={13} /> New open-ended gift profile
          </button>
        </div>

        <label className="flex items-start gap-2 text-sm mb-4" style={{ color: '#374151' }}>
          <input type="checkbox" checked={giftMode} onChange={e => setGiftMode(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="font-semibold">Open-ended gift</span>
            <span className="block text-xs mt-0.5" style={{ color: '#6B7280' }}>No niche/industry is locked in. The recipient chooses their profile details after tapping the card.</span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            value={pageName}
            onChange={e => setPageName(e.target.value)}
            placeholder={giftMode ? 'Optional recipient name' : (claimType === 'creator' ? 'Page name' : 'Business name')}
            className="border rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: '#E5E7EB' }}
          />
          {claimType === 'creator' ? (
            <select disabled={giftMode} value={niche} onChange={e => setNiche(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm outline-none disabled:bg-gray-50 disabled:text-gray-400" style={{ borderColor: '#E5E7EB' }}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <select disabled={giftMode} value={industry} onChange={e => setIndustry(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm outline-none disabled:bg-gray-50 disabled:text-gray-400" style={{ borderColor: '#E5E7EB' }}>
              {BUSINESS_CATEGORIES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </div>

        <div className="border rounded-xl p-4 mb-4" style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Full gift page details</p>
          <p className="text-xs mb-4" style={{ color: '#6B7280' }}>This is the same full information set available in the normal creator setup. You can prepare the page completely for the recipient before giving them the NFC card.</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <OnboardingField label="Username" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} />
            <OnboardingField label="Location" placeholder="Addis Ababa, Ethiopia" icon={MapPin} value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <OnboardingField label="Language" placeholder="Amharic, English" icon={Languages} value={language} onChange={e => setLanguage(e.target.value)} />
            <OnboardingField label="Portfolio link" placeholder="https://..." icon={Link2} value={portfolioLink} onChange={e => setPortfolioLink(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <ImageUploadTile label="Profile photo" shape="circle" previewUrl={avatarPreview} onFile={f => handleAdminImage(f, 'avatar')} />
            <ImageUploadTile label="Cover / banner image" shape="banner" previewUrl={bannerPreview} onFile={f => handleAdminImage(f, 'banner')} />
          </div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people about this person and what they do" rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none mb-4" style={{ borderColor: '#E5E7EB' }} />
          {claimType === 'creator' && <>
            <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Social platforms</p>
            <div className="flex flex-col gap-2 mb-4">
              {PLATFORM_LIST.map(row => <div key={row.p} className="grid grid-cols-3 gap-2">
                <input placeholder={`${row.p} handle`} value={socials[row.p]?.handle || ''} onChange={e => updateSocial(row.p, 'handle', e.target.value)} className="border rounded-lg px-3 py-2 text-xs outline-none" style={{ borderColor: '#E5E7EB' }} />
                <input placeholder="Followers" value={socials[row.p]?.followers || ''} onChange={e => updateSocial(row.p, 'followers', e.target.value)} className="border rounded-lg px-3 py-2 text-xs outline-none" style={{ borderColor: '#E5E7EB' }} />
                <input placeholder="Engagement %" value={socials[row.p]?.engagement || ''} onChange={e => updateSocial(row.p, 'engagement', e.target.value)} className="border rounded-lg px-3 py-2 text-xs outline-none" style={{ borderColor: '#E5E7EB' }} />
              </div>)}
            </div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Audience & metrics</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input placeholder="Audience age" value={audience.age} onChange={e => setAudience(a => ({...a, age:e.target.value}))} className="border rounded-lg px-3 py-2 text-xs" style={{borderColor:'#E5E7EB'}} />
              <input placeholder="Audience gender" value={audience.gender} onChange={e => setAudience(a => ({...a, gender:e.target.value}))} className="border rounded-lg px-3 py-2 text-xs" style={{borderColor:'#E5E7EB'}} />
              <input placeholder="Audience location" value={audience.location} onChange={e => setAudience(a => ({...a, location:e.target.value}))} className="border rounded-lg px-3 py-2 text-xs" style={{borderColor:'#E5E7EB'}} />
              <input placeholder="Average views" value={audience.avg_views} onChange={e => setAudience(a => ({...a, avg_views:e.target.value}))} className="border rounded-lg px-3 py-2 text-xs" style={{borderColor:'#E5E7EB'}} />
              <input placeholder="Average reach" value={audience.avg_reach} onChange={e => setAudience(a => ({...a, avg_reach:e.target.value}))} className="border rounded-lg px-3 py-2 text-xs" style={{borderColor:'#E5E7EB'}} />
            </div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Services & pricing</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.keys(pricing).map(k => <input key={k} placeholder={k.replace('_',' ')} value={pricing[k]} onChange={e => setPricing(p => ({...p,[k]:e.target.value}))} className="border rounded-lg px-3 py-2 text-xs" style={{borderColor:'#E5E7EB'}} />)}
            </div>
          </>}
          <div className="grid grid-cols-2 gap-4">
            <select value={availability} onChange={e => setAvailability(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm" style={{borderColor:'#E5E7EB'}}><option>Available now</option><option>Limited availability</option><option>Not currently available</option></select>
            <input value={preferences} onChange={e => setPreferences(e.target.value)} placeholder="Professional preferences" className="border rounded-lg px-3 py-2.5 text-sm" style={{borderColor:'#E5E7EB'}} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm mb-4" style={{ color: '#374151' }}>
          <input type="checkbox" checked={verifiedOnCreate} onChange={e => setVerifiedOnCreate(e.target.checked)} />
          Mark verified right away
        </label>

        <button onClick={handleCreate} disabled={creating || setupStatus !== 'ready'} style={{ background: '#E6007A' }} className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-50">
          {creating ? 'Creating…' : 'Create gift page'}
        </button>

        {createError && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{createError}</p>}

        {newLink && (
          <div className="mt-4 border rounded-xl p-4" style={{ borderColor: '#00D9FF', background: '#E0FBFF' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#036377' }}>Official creator page — write this URL to the NFC card</p>
            <div className="flex items-center gap-2">
              <p className="text-xs flex-1 truncate cm-mono" style={{ color: '#036377' }}>{newLink}</p>
              <button onClick={() => window.open(newLink, '_blank', 'noopener,noreferrer')} className="text-xs font-semibold shrink-0" style={{ color: '#111827' }}>Open</button>
              <button onClick={() => copyLink(newLink)} className="text-xs font-semibold shrink-0" style={{ color: '#036377' }}>
                {copied === newLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => writeNfc(newLink)}
                disabled={nfcWriting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ background: '#111827' }}
              >
                <Zap size={13} /> {nfcWriting ? 'Hold NTAG215 near phone…' : 'Write to NTAG215'}
              </button>
              <span className="text-[11px]" style={{ color: '#036377' }}>NTAG215 has enough NDEF capacity for this URL.</span>
            </div>
            {nfcMessage && <p className="text-xs mt-3" style={{ color: nfcMessage.startsWith('Success') ? '#0E7A3B' : '#9A4A0C' }}>{nfcMessage}</p>}
            {setupLink && <div className="mt-4 pt-3 border-t" style={{ borderColor: '#BFEFF5' }}>
              <p className="text-[11px] font-semibold mb-1" style={{ color: '#036377' }}>Private setup link (give this to the recipient)</p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] flex-1 truncate cm-mono" style={{ color: '#6B7280' }}>{setupLink}</p>
                <button onClick={() => copyLink(setupLink)} className="text-xs font-semibold shrink-0" style={{ color: '#036377' }}>{copied === setupLink ? 'Copied!' : 'Copy setup link'}</button>
              </div>
            </div>}
          </div>
        )}
      </div>

      {loadingRows ? (
        <p className="text-sm" style={{ color: '#6B7280' }}>Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Pending approval ({pending.length})</p>
              <div className="flex flex-col gap-3">{pending.map(r => <RowCard key={r.kind + r.id} r={r} />)}</div>
            </div>
          )}
          {waiting.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Gift/NFC cards not yet claimed ({waiting.length})</p>
              <div className="flex flex-col gap-3">{waiting.map(r => <RowCard key={r.kind + r.id} r={r} />)}</div>
            </div>
          )}
          {live.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Live on the site ({live.length})</p>
              <div className="flex flex-col gap-3">{live.map(r => <RowCard key={r.kind + r.id} r={r} />)}</div>
            </div>
          )}
          {rows.length === 0 && <p className="text-sm" style={{ color: '#6B7280' }}>No profiles yet.</p>}
        </>
      )}
    </div>
  );
};

const ResetPasswordPage = ({ onDone }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password should be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords don\'t match.'); return; }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (updateError) { setError(updateError.message || 'Could not update your password.'); return; }
    setDone(true);
    // Clear the recovery token out of the address bar and hand back to the app.
    window.history.replaceState({}, '', '/');
    setTimeout(() => onDone(), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: '#F8FAFC' }}>
      <div className="max-w-sm w-full bg-white border rounded-2xl p-6" style={{ borderColor: '#E5E7EB' }}>
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={28} className="mx-auto mb-3" style={{ color: '#0E7A3B' }} />
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>Password updated</p>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Taking you back in…</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Set a new password</p>
            <p className="text-xs mb-5" style={{ color: '#6B7280' }}>You followed a password reset link — choose a new password to finish.</p>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5 mb-3" style={{ borderColor: '#E5E7EB' }}>
              <Lock size={15} style={{ color: '#6B7280' }} />
              <input required type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="flex-1 outline-none text-sm" />
            </div>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5" style={{ borderColor: '#E5E7EB' }}>
              <Lock size={15} style={{ color: '#6B7280' }} />
              <input required type="password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="flex-1 outline-none text-sm" />
            </div>
            {error && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{error}</p>}
            <button disabled={saving} style={{ background: '#E6007A' }} className="w-full text-white text-sm font-semibold py-2.5 rounded-lg mt-4 disabled:opacity-50">
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// Global "Back" button — shown on every page except Home. Tracks page
// history automatically (via the effect below) so it works no matter which
// of the many setPage() call sites triggered the navigation.
const BackButton = ({ onClick, style }) => (
  <button
    onClick={onClick}
    className="cm-mono inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
    style={{ color: '#6B7280', background: '#fff', border: '1px solid #E5E7EB', ...style }}
  >
    <ChevronLeft size={14} /> Back
  </button>
);

export default function Commissioner() {
  const [page, setPage] = useState('home');
  const [pageHistory, setPageHistory] = useState([]);
  const prevPageRef = React.useRef('home');
  useEffect(() => {
    if (prevPageRef.current !== page) {
      setPageHistory(h => [...h, prevPageRef.current]);
      prevPageRef.current = page;
    }
  }, [page]);
  const goBack = () => {
    setPageHistory(h => {
      if (h.length === 0) { setPage('home'); return h; }
      const next = [...h];
      const last = next.pop();
      setPage(last);
      return next;
    });
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [appliedIds, setAppliedIds] = useState([]);
  const [toast, setToast] = useState('');
  const [claimToken] = useState(() => new URLSearchParams(window.location.search).get('claim'));
  const [authRedirect] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('auth') === '1' ? (params.get('returnTo') || '/') : null;
  });
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const officialType = pathParts[0] || '';
  const officialId = pathParts[1] || '';

  const toggleSave = (id) => setSavedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const [messageRecipientId, setMessageRecipientId] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const onHire = async (creator) => {
    if (!session) { setPage('auth'); return; }
    if (!creator.authUserId) { setToast('This creator has not connected a messaging account yet.'); setTimeout(() => setToast(''), 3000); return; }
    setMessageRecipientId(creator.authUserId);
    setPage('messages');
  };
  const onApply = (campaign) => {
    if (!session) { setPage('auth'); return; }
    setAppliedIds(a => [...a, campaign.id]);
    setToast(`Application sent for "${campaign.title}".`);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === 'PASSWORD_RECOVERY') {
        // The user followed a "reset your password" email link. Supabase has
        // already exchanged the token in the URL for a temporary session —
        // send them straight to the "set a new password" screen instead of
        // silently dropping them on the homepage still logged in.
        setPage('reset-password');
        return;
      }
      if (sess && authRedirect) {
        window.history.replaceState({}, '', authRedirect);
        window.location.reload();
        return;
      }
      if (sess) setPage(p => (p === 'auth' ? 'dashboard' : p));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (page === 'reset-password') {
    return (
      <div className="cm-root min-h-screen bg-white">
        <FontLoader />
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-5">
          <BackButton onClick={() => setPage(session ? 'dashboard' : 'auth')} />
        </div>
        <ResetPasswordPage onDone={() => setPage(session ? 'dashboard' : 'auth')} />
      </div>
    );
  }

  if (officialType === 'creator' && officialId) {
    return (
      <div className="cm-root min-h-screen bg-white">
        <FontLoader />
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-5">
          <BackButton onClick={() => { window.history.length > 1 ? window.history.back() : (window.location.href = '/'); }} />
        </div>
        <OfficialCreatorPage id={officialId} session={session} setPage={setPage} />
      </div>
    );
  }
  if (officialType === 'business' && officialId) {
    return (
      <div className="cm-root min-h-screen bg-white">
        <FontLoader />
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-5">
          <BackButton onClick={() => { window.history.length > 1 ? window.history.back() : (window.location.href = '/'); }} />
        </div>
        <OfficialBusinessPage id={officialId} session={session} />
      </div>
    );
  }
  if (claimToken) {
    return (
      <div className="cm-root min-h-screen" style={{ background: '#F8FAFC' }}>
        <FontLoader />
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-5">
          <BackButton onClick={() => { window.location.href = '/'; }} />
        </div>
        <ClaimGate token={claimToken} session={session} setPage={setPage} />
      </div>
    );
  }

  return (
    <div className="cm-root min-h-screen" style={{ background: '#F8FAFC' }}>
      <FontLoader />
      <NavBar page={page} setPage={p => { setPage(p); setMenuOpen(false); }} menuOpen={menuOpen} setMenuOpen={setMenuOpen} session={session} />
      {page !== 'home' && (
        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-5">
          <BackButton onClick={goBack} />
        </div>
      )}
      {authRedirect && page === 'home' ? <Auth onAuthenticated={() => { window.history.replaceState({}, '', authRedirect); window.location.reload(); }} /> : null}
      {!authRedirect && page === 'home' && <Home setPage={setPage} />}
      {page === 'creators' && <Creators session={session} savedIds={savedIds} toggleSave={toggleSave} onHire={onHire} />}
      {page === 'businesses' && <Businesses onConnect={(b) => { if (!session) setPage('auth'); else { setSelectedBusiness(b); setPage('network'); } }} />}
      {page === 'marketplace' && <Marketplace onMessage={(owner) => onHire(owner && owner.auth_user_id ? {authUserId: owner.auth_user_id} : owner)} />}
      {page === 'network' && <B2BNetwork session={session} initialBusiness={selectedBusiness} />}
      {page === 'trust' && <TrustCenter session={session} />}
      {page === 'campaigns' && <Campaigns session={session} setPage={setPage} appliedIds={appliedIds} onApply={onApply} />}
      {page === 'spotlight' && <Spotlight />}
      {page === 'messages' && <Messages session={session} initialRecipientId={messageRecipientId} />}
      {page === 'pricing' && <Pricing />}
      {page === 'about' && <AboutUs />}
      {page === 'trust' && <TrustSafety />}
      {page === 'terms' && <TermsOfService />}
      {page === 'dashboard' && <Dashboard session={session} />}
      {page === 'onboarding' && (session?.user?.user_metadata?.role === 'business' ? <BusinessOnboarding session={session} setPage={setPage} /> : <Onboarding session={session} setPage={setPage} />)}
      {page === 'account' && (session ? <AccountSettings session={session} setPage={setPage} /> : <Auth onAuthenticated={() => setPage('account')} />)}
      {page === 'admin' && <AdminPanel session={session} />}
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
