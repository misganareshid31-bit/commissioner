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
  Phone, Upload, ChevronLeft, Check, Video, Link2, Languages
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

const Avatar = ({ name, size = 44, tone = 0, ring = false }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const [bg, fg] = AVATAR_PALETTE[tone % AVATAR_PALETTE.length];
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

const CREATORS = [
  { id: 1, name: 'Amara Bekele', handle: '@amara.eats', niche: 'Food & Restaurants', city: 'Addis Ababa, ET', followers: '184K', engagement: '6.8%', price: 120, platforms: ['instagram', 'tiktok'], verified: true, response: '2 hrs', tone: 0 },
  { id: 2, name: 'Daniel Osei', handle: '@danoseitech', niche: 'Technology', city: 'Accra, GH', followers: '92K', engagement: '5.1%', price: 90, platforms: ['youtube', 'tiktok'], verified: true, response: '4 hrs', tone: 1 },
  { id: 3, name: 'Layla Haidari', handle: '@laylastyled', niche: 'Fashion', city: 'Dubai, AE', followers: '412K', engagement: '4.3%', price: 320, platforms: ['instagram', 'youtube'], verified: true, response: '1 hr', tone: 2 },
  { id: 4, name: 'Kwame Mensah', handle: '@kwamefit', niche: 'Fitness', city: 'Lagos, NG', followers: '61K', engagement: '8.2%', price: 65, platforms: ['tiktok', 'instagram'], verified: false, response: '6 hrs', tone: 3 },
  { id: 5, name: 'Nadia Farouk', handle: '@nadiatravels', niche: 'Travel', city: 'Cairo, EG', followers: '256K', engagement: '5.9%', price: 210, platforms: ['instagram', 'youtube'], verified: true, response: '3 hrs', tone: 4 },
  { id: 6, name: 'Tomiwa Adekunle', handle: '@tomicreates', niche: 'Comedy', city: 'Nairobi, KE', followers: '338K', engagement: '9.4%', price: 180, platforms: ['tiktok', 'facebook'], verified: true, response: '2 hrs', tone: 5 },
  { id: 7, name: 'Selam Girma', handle: '@selamlens', niche: 'Photography', city: 'Addis Ababa, ET', followers: '48K', engagement: '7.1%', price: 75, platforms: ['instagram'], verified: false, response: '5 hrs', tone: 0 },
  { id: 8, name: 'Ravi Chandran', handle: '@raviplays', niche: 'Gaming', city: 'London, UK', followers: '129K', engagement: '6.2%', price: 140, platforms: ['youtube', 'tiktok'], verified: true, response: '3 hrs', tone: 1 },
];

const CAMPAIGNS = [
  { id: 1, title: 'Launch reel for new espresso line', business: 'Northfield Coffee Co.', budget: '$400 – $800', platform: 'Instagram', city: 'Addis Ababa, ET', deadline: 'Aug 22', niche: 'Food & Restaurants', creators: 4, status: 'Open', tone: 0 },
  { id: 2, title: 'App onboarding walkthrough series', business: 'Ledger Finance', budget: '$1,200 – $2,000', platform: 'YouTube', city: 'Remote', deadline: 'Sep 3', niche: 'Finance', creators: 2, status: 'Reviewing', tone: 1 },
  { id: 3, title: 'Streetwear drop unboxing', business: 'Kessa Apparel', budget: '$250 – $500', platform: 'TikTok', city: 'Lagos, NG', deadline: 'Aug 18', niche: 'Fashion', creators: 6, status: 'Open', tone: 2 },
  { id: 4, title: '30-day fitness challenge partnership', business: 'Pulse Athletics', budget: '$600 – $1,100', platform: 'Instagram', city: 'Nairobi, KE', deadline: 'Aug 29', niche: 'Fitness', creators: 3, status: 'In Progress', tone: 3 },
  { id: 5, title: 'City guide short-form series', business: 'Horizon Travel', budget: '$900 – $1,500', platform: 'TikTok', city: 'Cairo, EG', deadline: 'Sep 10', niche: 'Travel', creators: 5, status: 'Open', tone: 4 },
];

const CONVERSATIONS = [
  { id: 1, name: 'Northfield Coffee Co.', preview: 'Sounds great — can you send a draft storyboard by Thursday?', time: '2m', unread: 2, online: true, tone: 0, isBusiness: true },
  { id: 2, name: 'Layla Haidari', preview: 'Just uploaded the raw footage to the workspace folder', time: '38m', unread: 0, online: true, tone: 2, isBusiness: false },
  { id: 3, name: 'Kessa Apparel', preview: 'We loved the concept board — approving now', time: '1h', unread: 1, online: false, tone: 2, isBusiness: true },
  { id: 4, name: 'Pulse Athletics', preview: 'Budget confirmed at $850 for the 3-part series', time: '3h', unread: 0, online: false, tone: 3, isBusiness: true },
  { id: 5, name: 'Ravi Chandran', preview: 'Thanks for the intro to the campaign brief!', time: 'Yesterday', unread: 0, online: false, tone: 1, isBusiness: false },
];

const THREAD = [
  { from: 'them', text: "Hi! We loved your Reel concept for the espresso launch.", time: '10:02 AM' },
  { from: 'them', text: "Budget is confirmed at $650 for one Reel + two Stories.", time: '10:03 AM' },
  { from: 'me', text: "That works for me. I can have a storyboard over by Wednesday.", time: '10:11 AM' },
  { from: 'them', text: "Perfect — I've opened a campaign workspace so we can track the brief and approvals in one place.", time: '10:12 AM', attachment: 'Campaign brief — Espresso Launch.pdf' },
  { from: 'me', text: "Got it, reviewing now. Sounds great — can you send a draft storyboard by Thursday?", time: '10:14 AM' },
];

const EARNINGS = [
  { month: 'Mar', value: 1180 }, { month: 'Apr', value: 1620 }, { month: 'May', value: 1440 },
  { month: 'Jun', value: 2010 }, { month: 'Jul', value: 2640 }, { month: 'Aug', value: 3120 },
];

const ENGAGEMENT = [
  { day: 'Mon', value: 4.8 }, { day: 'Tue', value: 5.6 }, { day: 'Wed', value: 5.1 },
  { day: 'Thu', value: 6.9 }, { day: 'Fri', value: 6.2 }, { day: 'Sat', value: 7.4 }, { day: 'Sun', value: 6.8 },
];

const NICHES = ['Food & Restaurants', 'Fashion', 'Beauty', 'Technology', 'Gaming', 'Fitness', 'Travel', 'Comedy'];

const SPOTLIGHT_VIDEOS = [
  { id: 1, creator: 'Amara Bekele', niche: 'Food & Restaurants', views: '48.2K', duration: '0:24', tone: 0, verified: true, trending: true },
  { id: 2, creator: 'Tomiwa Adekunle', niche: 'Comedy', views: '112K', duration: '0:31', tone: 5, verified: true, trending: true },
  { id: 3, creator: 'Layla Haidari', niche: 'Fashion', views: '76.9K', duration: '0:18', tone: 2, verified: true, trending: false },
  { id: 4, creator: 'Kwame Mensah', niche: 'Fitness', views: '22.4K', duration: '0:45', tone: 3, verified: false, trending: false },
  { id: 5, creator: 'Nadia Farouk', niche: 'Travel', views: '61.3K', duration: '0:52', tone: 4, verified: true, trending: true },
  { id: 6, creator: 'Ravi Chandran', niche: 'Gaming', views: '34.7K', duration: '0:29', tone: 1, verified: true, trending: false },
  { id: 7, creator: 'Selam Girma', niche: 'Photography', views: '15.1K', duration: '0:22', tone: 0, verified: false, trending: false },
  { id: 8, creator: 'Daniel Osei', niche: 'Technology', views: '58.6K', duration: '0:38', tone: 1, verified: true, trending: false },
];

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

const ONBOARDING_STEPS = ['Basic info', 'Niche', 'Social accounts', 'Portfolio', 'Pricing'];

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
  const links = [
    { id: 'home', label: 'Home' },
    { id: 'creators', label: 'Discover creators' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'messages', label: 'Messages' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'dashboard', label: 'Dashboard' },
  ];
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
            <button
              onClick={() => setPage('dashboard')}
              className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg"
              style={{ color: '#111827' }}
            >
              <span style={{ background: '#0E7A3B' }} className="w-2 h-2 rounded-full" />
              {session.user.email}
            </button>
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
          <button
            onClick={() => { setPage(session ? 'dashboard' : 'auth'); setMenuOpen(false); }}
            className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold"
            style={{ color: '#E6007A' }}
          >
            {session ? session.user.email : 'Sign in'}
          </button>
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

const CreatorCard = ({ c }) => (
  <div
    className="cm-card-hover bg-white rounded-2xl border p-5 flex flex-col gap-4"
    style={{ borderColor: '#E5E7EB' }}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <Avatar name={c.name} size={48} tone={c.tone} ring={c.verified} />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm" style={{ color: '#111827' }}>{c.name}</p>
            {c.verified && <CheckCircle2 size={14} style={{ color: '#00A8CC' }} strokeWidth={2.5} />}
          </div>
          <p className="cm-mono text-xs" style={{ color: '#6B7280' }}>{c.handle}</p>
        </div>
      </div>
      <button style={{ color: '#6B7280' }}><Star size={18} /></button>
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
        <p className="cm-mono text-sm font-semibold" style={{ color: '#111827' }}>~{c.response}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Response</p>
      </div>
    </div>

    <div className="cm-beam-reveal h-px w-full cm-beam" />

    <div className="flex items-center justify-between pt-1">
      <div>
        <p className="cm-mono text-base font-semibold" style={{ color: '#111827' }}>${c.price}</p>
        <p className="text-[11px]" style={{ color: '#6B7280' }}>Starting price</p>
      </div>
      <button style={{ background: '#E6007A' }} className="text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90">
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
          <Sparkles size={13} /> Now matching creators and businesses in 40+ cities
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

    {/* live match strip — signature element */}
    <section className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-2 h-2 rounded-full cm-live-dot" style={{ background: '#E6007A' }} />
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Live matches on Commissioner</p>
      </div>
      <div className="flex gap-4 overflow-x-auto cm-scroll pb-2">
        {CREATORS.slice(0, 6).map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 bg-white border rounded-2xl px-4 py-3 shrink-0" style={{ borderColor: '#E5E7EB' }}>
            <Avatar name={c.name} size={36} tone={c.tone} />
            <div className="h-px w-8 cm-beam" />
            <div style={{ background: '#F8FAFC' }} className="w-9 h-9 rounded-full flex items-center justify-center">
              <Building2 size={16} style={{ color: '#6B7280' }} />
            </div>
            <div className="pl-1">
              <p className="text-xs font-semibold" style={{ color: '#111827' }}>{c.niche} match</p>
              <p className="text-[11px]" style={{ color: '#6B7280' }}>{c.city}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* stats */}
    <section style={{ background: '#111827' }} className="mt-16 py-14">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { v: '18,400+', l: 'Verified creators' },
          { v: '3,200+', l: 'Businesses onboard' },
          { v: '$9.2M', l: 'Paid to creators' },
          { v: '97%', l: 'Campaign satisfaction' },
        ].map(s => (
          <div key={s.l}>
            <p className="cm-display font-bold text-3xl md:text-4xl mb-1" style={{ color: '#00D9FF' }}>{s.v}</p>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>

    {/* featured creators */}
    <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="cm-display font-bold text-2xl md:text-3xl" style={{ color: '#111827' }}>Featured creators</h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Vetted, verified, and ready for your next campaign.</p>
        </div>
        <button onClick={() => setPage('creators')} className="text-sm font-semibold flex items-center gap-1 shrink-0" style={{ color: '#036377' }}>
          View all <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {CREATORS.slice(0, 4).map(c => <CreatorCard key={c.id} c={c} />)}
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

    {/* testimonials */}
    <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
      <h2 className="cm-display font-bold text-2xl md:text-3xl mb-10" style={{ color: '#111827' }}>Trusted by creators and businesses</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { q: 'Commissioner turned my Spotlight page into a steady stream of paid campaigns — I stopped chasing brands and let them come to me.', n: 'Nadia Farouk', r: 'Travel creator', tone: 4 },
          { q: 'The campaign workspace made revisions painless. We knew exactly where every deliverable stood.', n: 'Northfield Coffee Co.', r: 'Marketing lead', tone: 0 },
          { q: 'Verification gave us confidence to work with creators we\'d never met in person. Payment reliability scores sealed it.', n: 'Kessa Apparel', r: 'Brand manager', tone: 2 },
        ].map(t => (
          <div key={t.n} className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex gap-0.5 mb-4">
              {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="#00D9FF" style={{ color: '#00D9FF' }} />)}
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#374151' }}>&ldquo;{t.q}&rdquo;</p>
            <div className="flex items-center gap-2.5">
              <Avatar name={t.n} size={32} tone={t.tone} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#111827' }}>{t.n}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{t.r}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* CTA */}
    <section className="max-w-7xl mx-auto px-5 md:px-8 pb-4">
      <div className="rounded-3xl p-10 md:p-14 relative overflow-hidden" style={{ background: '#111827' }}>
        <div className="relative max-w-lg">
          <h2 className="cm-display font-bold text-2xl md:text-3xl text-white mb-3">Ready to start collaborating?</h2>
          <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>Join thousands of creators and businesses already building campaigns on Commissioner.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setPage('creators')} style={{ background: '#E6007A' }} className="text-white font-semibold px-6 py-3 rounded-xl">Hire creators</button>
            <button onClick={() => setPage('onboarding')} style={{ borderColor: '#00D9FF', color: '#00D9FF' }} className="border-2 font-semibold px-6 py-3 rounded-xl">Join as a creator</button>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const Creators = () => {
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState('All');
  const filtered = CREATORS.filter(c =>
    (niche === 'All' || c.niche === niche) &&
    (query === '' || c.name.toLowerCase().includes(query.toLowerCase()) || c.niche.toLowerCase().includes(query.toLowerCase()) || c.city.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <div className="mb-7">
        <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Discover creators</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>{filtered.length} creators match your search</p>
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
        <button className="flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-medium" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
          <SlidersHorizontal size={15} /> Filters
        </button>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map(c => <CreatorCard key={c.id} c={c} />)}
      </div>
    </div>
  );
};

const Campaigns = () => (
  <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Campaigns</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>Open opportunities from verified businesses</p>
      </div>
      <button style={{ background: '#E6007A' }} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg shrink-0">
        Post a campaign
      </button>
    </div>

    <div className="flex flex-col gap-4">
      {CAMPAIGNS.map(camp => (
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
              <button style={{ background: '#111827' }} className="text-white text-xs font-semibold px-4 py-2.5 rounded-lg">Apply</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Messages = () => {
  const [active, setActive] = useState(1);
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
            {CONVERSATIONS.map(c => (
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
            {THREAD.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div style={{ maxWidth: '75%' }}>
                  <div
                    className="rounded-2xl px-4 py-2.5 text-sm"
                    style={{
                      background: m.from === 'me' ? '#E6007A' : 'white',
                      color: m.from === 'me' ? 'white' : '#111827',
                      border: m.from === 'me' ? 'none' : '1px solid #E5E7EB'
                    }}
                  >
                    {m.text}
                  </div>
                  {m.attachment && (
                    <div className="mt-1.5 flex items-center gap-2 border rounded-lg px-3 py-2 bg-white" style={{ borderColor: '#00D9FF' }}>
                      <FileText size={14} style={{ color: '#036377' }} />
                      <span className="text-xs font-medium" style={{ color: '#036377' }}>{m.attachment}</span>
                    </div>
                  )}
                  <p className="text-[10px] mt-1 px-1" style={{ color: '#9CA3AF' }}>{m.time}</p>
                </div>
              </div>
            ))}
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

const Dashboard = () => (
  <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <Avatar name="Amara Bekele" size={56} tone={0} ring />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="cm-display font-bold text-xl" style={{ color: '#111827' }}>Amara Bekele</h1>
            <VerifiedBadge />
          </div>
          <p className="text-sm" style={{ color: '#6B7280' }}>Food & Restaurants creator · Addis Ababa, ET</p>
        </div>
      </div>
      <span style={{ background: '#111827' }} className="text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 w-fit">
        <Zap size={13} style={{ color: '#00D9FF' }} /> Pro plan
      </span>
    </div>

    {/* profile completion + connector to earnings, the beam motif */}
    <div className="bg-white border rounded-2xl p-5 mb-6" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Profile completion</p>
        <p className="cm-mono text-sm font-semibold" style={{ color: '#E6007A' }}>82%</p>
      </div>
      <div className="h-2 rounded-full w-full" style={{ background: '#F3F4F6' }}>
        <div className="h-2 rounded-full cm-beam" style={{ width: '82%' }} />
      </div>
      <p className="text-xs mt-2" style={{ color: '#6B7280' }}>Add two more portfolio pieces to reach 100% and improve your discovery ranking.</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard icon={Wallet} label="Earnings this month" value="$3,120" />
      <StatCard icon={MessageSquare} label="Unread messages" value="3" />
      <StatCard icon={Briefcase} label="Campaign invitations" value="4" />
      <StatCard icon={Award} label="Avg. rating" value="4.9 / 5" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
      <div className="lg:col-span-2 bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Earnings</p>
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#0E7A3B' }}><TrendingUp size={13} /> +18% vs last month</span>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={EARNINGS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E6007A" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#E6007A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E5E7EB' }} formatter={v => [`$${v}`, 'Earnings']} />
              <Area type="monotone" dataKey="value" stroke="#E6007A" strokeWidth={2} fill="url(#earnFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Weekly engagement</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ENGAGEMENT} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E5E7EB' }} formatter={v => [`${v}%`, 'Engagement']} />
              <Bar dataKey="value" fill="#00D9FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Campaign invitations</p>
        <div className="flex flex-col gap-3">
          {CAMPAIGNS.slice(0, 3).map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div style={{ background: '#F8FAFC' }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                  <Building2 size={15} style={{ color: '#6B7280' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{c.title}</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{c.business}</p>
                </div>
              </div>
              <StatusPill status={c.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Account status</p>
        <div className="flex flex-col gap-3.5">
          {[
            { icon: UserCheck, l: 'Verification', v: 'Approved', c: '#0E7A3B' },
            { icon: Zap, l: 'Subscription', v: 'Pro — 20 videos', c: '#111827' },
            { icon: Play, l: 'Spotlight videos', v: '12 / 20 used', c: '#111827' },
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

const OnboardingField = ({ label, placeholder, icon: Icon }) => (
  <div>
    <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>{label}</label>
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5" style={{ borderColor: '#E5E7EB' }}>
      {Icon && <Icon size={15} style={{ color: '#6B7280' }} />}
      <input placeholder={placeholder} className="flex-1 outline-none text-sm" />
    </div>
  </div>
);

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [primaryNiche, setPrimaryNiche] = useState('Food & Restaurants');
  const [secondary, setSecondary] = useState(['Photography']);

  const toggleSecondary = (n) => {
    if (secondary.includes(n)) setSecondary(secondary.filter(s => s !== n));
    else if (secondary.length < 3) setSecondary([...secondary, n]);
  };

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
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div style={{ background: '#F8FAFC' }} className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed" >
                <Camera size={20} style={{ color: '#6B7280' }} />
              </div>
              <button className="text-xs font-semibold border rounded-lg px-3 py-2" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Upload photo</button>
            </div>
            <OnboardingField label="Full name" placeholder="e.g. Amara Bekele" />
            <div className="grid grid-cols-2 gap-4">
              <OnboardingField label="City" placeholder="e.g. Addis Ababa" icon={MapPin} />
              <OnboardingField label="Country" placeholder="e.g. Ethiopia" icon={Globe} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <OnboardingField label="Phone number" placeholder="+251 ..." icon={Phone} />
              <OnboardingField label="Preferred language" placeholder="e.g. Amharic, English" icon={Languages} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Bio</label>
              <textarea placeholder="Tell businesses what you create and who you create it for" rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Primary niche <span style={{ color: '#6B7280', fontWeight: 400 }}>— choose one</span></p>
              <div className="flex flex-wrap gap-2">
                {NICHES.map(n => (
                  <button
                    key={n}
                    onClick={() => setPrimaryNiche(n)}
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

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {[
              { p: 'TikTok', icon: null },
              { p: 'Instagram', icon: Instagram },
              { p: 'YouTube', icon: Youtube },
              { p: 'Facebook', icon: Facebook },
            ].map(row => (
              <div key={row.p} className="flex items-center gap-3 border rounded-xl p-3.5" style={{ borderColor: '#E5E7EB' }}>
                <div style={{ background: '#E0FBFF' }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                  {row.icon ? <row.icon size={16} style={{ color: '#036377' }} /> : <span className="cm-display font-bold" style={{ color: '#036377' }}>♪</span>}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input placeholder="@username" className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }} />
                  <input placeholder="Follower count" className="text-sm outline-none border-b py-1" style={{ borderColor: '#F3F4F6' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: '#E5E7EB' }}>
              <Upload size={22} className="mx-auto mb-2" style={{ color: '#6B7280' }} />
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>Upload videos and images</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Showcase past collaborations and your best work</p>
            </div>
            <OnboardingField label="Portfolio link" placeholder="https://" icon={Link2} />
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-4">
            <OnboardingField label="TikTok video" placeholder="$" />
            <OnboardingField label="Instagram Reel" placeholder="$" />
            <OnboardingField label="Story" placeholder="$" />
            <OnboardingField label="YouTube video" placeholder="$" />
            <OnboardingField label="Monthly collaboration" placeholder="$" />
            <OnboardingField label="UGC content" placeholder="$" />
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
          onClick={() => setStep(Math.min(ONBOARDING_STEPS.length - 1, step + 1))}
          style={{ background: '#E6007A' }}
          className="flex items-center gap-1.5 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
        >
          {step === ONBOARDING_STEPS.length - 1 ? 'Finish setup' : 'Continue'} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------- app ---------------------------------- */

export default function Commissioner() {
  const [page, setPage] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) setPage(p => (p === 'auth' ? 'dashboard' : p));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <div className="cm-root min-h-screen" style={{ background: '#F8FAFC' }}>
      <FontLoader />
      <NavBar page={page} setPage={p => { setPage(p); setMenuOpen(false); }} menuOpen={menuOpen} setMenuOpen={setMenuOpen} session={session} />
      {page === 'home' && <Home setPage={setPage} />}
      {page === 'creators' && <Creators />}
      {page === 'campaigns' && <Campaigns />}
      {page === 'spotlight' && <Spotlight />}
      {page === 'messages' && <Messages />}
      {page === 'pricing' && <Pricing />}
      {page === 'dashboard' && <Dashboard />}
      {page === 'onboarding' && <Onboarding />}
      {page === 'auth' && (
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
          <Auth onAuthenticated={() => setPage('dashboard')} />
        </div>
      )}
      {page !== 'messages' && page !== 'onboarding' && page !== 'auth' && <Footer setPage={setPage} />}
    </div>
  );
}
