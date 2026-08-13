import React from 'react';
import { MapPin } from 'lucide-react';
import { VerifiedBadge } from './ui';

export default function ProfileHeader({ name, subtitle, city, verified, coverUrl, photoUrl, children }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
      <div
        className="h-32 md:h-44"
        style={{ background: coverUrl ? `url(${coverUrl}) center/cover` : 'linear-gradient(120deg, #FDE7F1, #E0FBFF)' }}
      />
      <div className="px-6 pb-6">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center font-bold text-xl cm-display shrink-0"
            style={{ background: photoUrl ? undefined : '#FDE7F1', color: '#99154F', backgroundImage: photoUrl ? `url(${photoUrl})` : undefined, backgroundSize: 'cover' }}
          >
            {!photoUrl && initials}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="cm-display font-bold text-xl" style={{ color: '#111827' }}>{name}</h1>
          {verified && <VerifiedBadge />}
        </div>
        {subtitle && <p className="text-sm mb-1" style={{ color: '#6B7280' }}>{subtitle}</p>}
        {city && <p className="flex items-center gap-1 text-xs mb-4" style={{ color: '#6B7280' }}><MapPin size={12} />{city}</p>}
        {children}
      </div>
    </div>
  );
}
