import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Badge, VerifiedBadge } from './ui';

export function CreatorCard({ profile }) {
  const initials = (profile.page_name || profile.username || '?').slice(0, 2).toUpperCase();
  return (
    <Link to={`/creator/${profile.username}`} className="block bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center gap-3 mb-3">
        <div style={{ background: '#FDE7F1', color: '#99154F' }} className="w-12 h-12 rounded-full flex items-center justify-center font-bold cm-display shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>{profile.page_name || profile.username}</p>
          <p className="cm-mono text-xs truncate" style={{ color: '#6B7280' }}>@{profile.username}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {profile.primary_niche && <Badge>{profile.primary_niche}</Badge>}
        {profile.city && <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}><MapPin size={12} />{profile.city}</span>}
      </div>
      {profile.verified && <VerifiedBadge />}
    </Link>
  );
}

export function BusinessCard({ profile }) {
  const initials = (profile.company_name || '?').slice(0, 2).toUpperCase();
  return (
    <Link to={`/business/${profile.slug}`} className="block bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center gap-3 mb-3">
        <div style={{ background: '#E0FBFF', color: '#036377' }} className="w-12 h-12 rounded-full flex items-center justify-center font-bold cm-display shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>{profile.company_name}</p>
          {profile.industry && <p className="text-xs truncate" style={{ color: '#6B7280' }}>{profile.industry}</p>}
        </div>
      </div>
      {profile.city && <span className="flex items-center gap-1 text-xs mb-2" style={{ color: '#6B7280' }}><MapPin size={12} />{profile.city}</span>}
      {profile.verified && <VerifiedBadge />}
    </Link>
  );
}
