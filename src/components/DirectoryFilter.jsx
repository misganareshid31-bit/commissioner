import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function DirectoryFilter({ query, setQuery, placeholder, verifiedOnly, setVerifiedOnly, extra }) {
  return (
    <div className="flex flex-col md:flex-row gap-3 mb-6">
      <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 flex-1" style={{ borderColor: '#E5E7EB' }}>
        <Search size={16} style={{ color: '#6B7280' }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} className="flex-1 outline-none text-sm" />
      </div>
      {extra}
      <label className="flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm font-medium cursor-pointer" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
        <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />
        Verified only
      </label>
    </div>
  );
}
