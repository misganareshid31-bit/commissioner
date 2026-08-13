import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { CreatorCard } from '../components/ProfileCard';
import DirectoryFilter from '../components/DirectoryFilter';
import { Select } from '../components/ui';

const NICHES = ['Food & Restaurants', 'Fashion', 'Beauty', 'Technology', 'Gaming', 'Fitness', 'Travel', 'Comedy'];

export default function CreatorDirectory() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [niche, setNiche] = useState('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = supabase.from('creator_profiles').select('*').not('username', 'is', null);
    if (verifiedOnly) q = q.eq('verified', true);
    if (niche !== 'All') q = q.eq('primary_niche', niche);
    q.then(({ data }) => { setCreators(data || []); setLoading(false); });
  }, [niche, verifiedOnly]);

  const filtered = creators.filter(c =>
    query === '' ||
    (c.page_name || '').toLowerCase().includes(query.toLowerCase()) ||
    (c.username || '').toLowerCase().includes(query.toLowerCase()) ||
    (c.city || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Discover creators</h1>
      <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{loading ? 'Loading…' : `${filtered.length} creators`}</p>

      <DirectoryFilter
        query={query} setQuery={setQuery}
        placeholder="Search by name, username, or city"
        verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
        extra={
          <Select value={niche} onChange={e => setNiche(e.target.value)}>
            <option value="All">All niches</option>
            {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
        }
      />

      {!loading && filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No creators match yet</p>
          <p className="text-xs" style={{ color: '#6B7280' }}>Try different filters, or check back as more creators join.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(c => <CreatorCard key={c.id} profile={c} />)}
        </div>
      )}
    </div>
  );
}
