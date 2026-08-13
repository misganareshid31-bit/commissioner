import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BusinessCard } from '../components/ProfileCard';
import DirectoryFilter from '../components/DirectoryFilter';
import { Input } from '../components/ui';

export default function BusinessDirectory() {
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = supabase.from('business_profiles').select('*').not('slug', 'is', null);
    if (verifiedOnly) q = q.eq('verified', true);
    q.then(({ data }) => { setBusinesses(data || []); setLoading(false); });
  }, [verifiedOnly]);

  const filtered = businesses.filter(b =>
    (query === '' || (b.company_name || '').toLowerCase().includes(query.toLowerCase()) || (b.city || '').toLowerCase().includes(query.toLowerCase())) &&
    (industry === '' || (b.industry || '').toLowerCase().includes(industry.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <h1 className="cm-display font-bold text-2xl md:text-3xl mb-2" style={{ color: '#111827' }}>Businesses</h1>
      <p className="text-sm mb-6" style={{ color: '#6B7280' }}>{loading ? 'Loading…' : `${filtered.length} businesses`}</p>

      <DirectoryFilter
        query={query} setQuery={setQuery}
        placeholder="Search by company name or city"
        verifiedOnly={verifiedOnly} setVerifiedOnly={setVerifiedOnly}
        extra={<Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Industry" />}
      />

      {!loading && filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>No businesses match yet</p>
          <p className="text-xs" style={{ color: '#6B7280' }}>Try different filters, or check back as more businesses join.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(b => <BusinessCard key={b.id} profile={b} />)}
        </div>
      )}
    </div>
  );
}
