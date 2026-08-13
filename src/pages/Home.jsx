import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, Users, Handshake, ArrowRight, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { CreatorCard, BusinessCard } from '../components/ProfileCard';

export default function Home() {
  const [query, setQuery] = useState('');
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [featuredBusinesses, setFeaturedBusinesses] = useState([]);
  const [counts, setCounts] = useState({ creators: null, businesses: null, verified: null });
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('creator_profiles').select('*').not('username', 'is', null).order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => setFeaturedCreators(data || []));
    supabase.from('business_profiles').select('*').not('slug', 'is', null).order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => setFeaturedBusinesses(data || []));
    supabase.from('creator_profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => setCounts(c => ({ ...c, creators: count ?? 0 })));
    supabase.from('business_profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => setCounts(c => ({ ...c, businesses: count ?? 0 })));
    supabase.from('creator_profiles').select('id', { count: 'exact', head: true }).eq('verified', true)
      .then(({ count }) => setCounts(c => ({ ...c, verified: count ?? 0 })));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/creators${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };

  return (
    <div>
      {/* hero */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 pt-16 pb-10">
        <div className="max-w-3xl">
          <span style={{ background: '#FDE7F1', color: '#99154F' }} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            Now in early access
          </span>
          <h1 className="cm-display font-bold leading-[1.05] mb-6" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.75rem)', color: '#111827' }}>
            Find the right creator for your business.
          </h1>
          <p className="text-lg mb-8 max-w-xl" style={{ color: '#374151' }}>
            Commissioner connects verified creators and businesses through premium, professional profile pages.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link to="/creators" style={{ background: '#E6007A' }} className="text-white font-semibold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2">
              Hire creators <ArrowRight size={16} />
            </Link>
            <Link to="/auth" style={{ borderColor: '#00D9FF', color: '#036377' }} className="border-2 font-semibold px-6 py-3.5 rounded-xl text-center">
              Join as a creator
            </Link>
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white border rounded-xl p-2 max-w-xl" style={{ borderColor: '#E5E7EB' }}>
            <Search size={18} style={{ color: '#6B7280' }} className="ml-2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by niche, platform, or city" className="flex-1 outline-none text-sm py-2" />
            <button type="submit" style={{ background: '#111827' }} className="text-white text-sm font-semibold px-4 py-2.5 rounded-lg">Search</button>
          </form>
        </div>
      </section>

      {/* featured creators */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="cm-display font-bold text-2xl" style={{ color: '#111827' }}>Featured creators</h2>
          <Link to="/creators" className="text-sm font-semibold flex items-center gap-1" style={{ color: '#036377' }}>View all <ArrowRight size={14} /></Link>
        </div>
        {featuredCreators.length === 0 ? (
          <div className="text-center py-12 border rounded-2xl" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No creators yet</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Be the first to join Commissioner.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredCreators.map(c => <CreatorCard key={c.id} profile={c} />)}
          </div>
        )}
      </section>

      {/* featured businesses */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="cm-display font-bold text-2xl" style={{ color: '#111827' }}>Featured businesses</h2>
          <Link to="/businesses" className="text-sm font-semibold flex items-center gap-1" style={{ color: '#036377' }}>View all <ArrowRight size={14} /></Link>
        </div>
        {featuredBusinesses.length === 0 ? (
          <div className="text-center py-12 border rounded-2xl" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No businesses yet</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Be the first business on Commissioner.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredBusinesses.map(b => <BusinessCard key={b.id} profile={b} />)}
          </div>
        )}
      </section>

      {/* how it works */}
      <section style={{ background: '#F8FAFC' }} className="py-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <h2 className="cm-display font-bold text-2xl md:text-3xl mb-10 text-center" style={{ color: '#111827' }}>How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Search, t: 'Build your profile', d: 'Creators and businesses set up a premium public profile page — no fake filler, just real information.' },
              { icon: ShieldCheck, t: 'Get verified', d: 'Our team manually reviews and verifies accounts, so a verified badge actually means something.' },
              { icon: Handshake, t: 'Connect directly', d: 'Businesses discover creators through search and verified profiles, then reach out directly.' },
            ].map(s => (
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

      {/* trust & verification */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="rounded-3xl p-10 md:p-14" style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck size={24} style={{ color: '#036377' }} />
            <h2 className="cm-display font-bold text-2xl" style={{ color: '#111827' }}>Verification you can trust</h2>
          </div>
          <p className="text-sm max-w-2xl" style={{ color: '#374151' }}>
            Every verified badge on Commissioner is reviewed manually by our team — not an automated checkbox.
            We're in early access, so verification is still being rolled out account by account.
          </p>
        </div>
      </section>

      {/* stats — real counts only, never fabricated */}
      <section style={{ background: '#111827' }} className="py-14">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-3 gap-8">
          {[
            { v: counts.creators, l: 'Creators on Commissioner' },
            { v: counts.businesses, l: 'Businesses on Commissioner' },
            { v: counts.verified, l: 'Verified profiles' },
          ].map(s => (
            <div key={s.l}>
              <p className="cm-display font-bold text-3xl md:text-4xl mb-1" style={{ color: '#00D9FF' }}>{s.v === null ? '…' : s.v}</p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="rounded-3xl p-10 md:p-14" style={{ background: '#111827' }}>
          <div className="max-w-lg">
            <h2 className="cm-display font-bold text-2xl md:text-3xl text-white mb-3">Ready to build your profile?</h2>
            <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>Commissioner is in early access — be one of the first verified profiles on the platform.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/creators" style={{ background: '#E6007A' }} className="text-white font-semibold px-6 py-3 rounded-xl text-center">Hire creators</Link>
              <Link to="/auth" style={{ borderColor: '#00D9FF', color: '#00D9FF' }} className="border-2 font-semibold px-6 py-3 rounded-xl text-center">Join as a creator</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
