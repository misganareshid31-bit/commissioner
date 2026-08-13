import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Instagram, Youtube, Facebook, ExternalLink, Radio, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import ProfileHeader from '../components/ProfileHeader';
import QRCodeBox from '../components/QRCodeBox';
import { Badge, Button, Card } from '../components/ui';

const PLATFORM_ICON = { Instagram, YouTube: Youtube, Facebook };

export default function CreatorProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [socials, setSocials] = useState([]);
  const [nfc, setNfc] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.from('creator_profiles').select('*').eq('username', username).maybeSingle()
      .then(({ data }) => {
        if (!data) { setNotFound(true); return; }
        setProfile(data);
        supabase.from('social_accounts').select('*').eq('creator_id', data.id).then(({ data: s }) => setSocials(s || []));
        supabase.from('nfc_cards').select('*').eq('creator_id', data.id).maybeSingle().then(({ data: n }) => setNfc(n));
      });
  }, [username]);

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <p className="text-lg font-semibold" style={{ color: '#111827' }}>Profile not found</p>
        <Link to="/creators" className="text-sm font-semibold mt-2 inline-block" style={{ color: '#E6007A' }}>Browse creators</Link>
      </div>
    );
  }
  if (!profile) return <div className="max-w-2xl mx-auto px-5 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading…</div>;

  const profileUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <ProfileHeader
          name={profile.page_name || profile.username}
          subtitle={profile.username ? `@${profile.username}` : null}
          city={profile.city}
          verified={profile.verified}
          coverUrl={profile.cover_image_url}
          photoUrl={profile.profile_photo_url}
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {profile.primary_niche && <Badge>{profile.primary_niche}</Badge>}
            {(profile.secondary_niches || []).map(n => <Badge key={n} tone="cyan">{n}</Badge>)}
            {nfc && <Badge tone="gray"><span className="flex items-center gap-1"><Radio size={11} /> NFC {nfc.status}</span></Badge>}
          </div>
          {profile.bio && <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{profile.bio}</p>}
        </ProfileHeader>

        {socials.length > 0 && (
          <Card>
            <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Social media</p>
            <div className="flex flex-col gap-3">
              {socials.map(s => {
                const Icon = PLATFORM_ICON[s.platform] || ExternalLink;
                return (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div style={{ background: '#E0FBFF' }} className="w-8 h-8 rounded-lg flex items-center justify-center">
                        <Icon size={14} style={{ color: '#036377' }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: '#111827' }}>{s.platform}</span>
                      {s.handle && <span className="cm-mono text-xs" style={{ color: '#6B7280' }}>{s.handle}</span>}
                    </div>
                    {s.followers != null && <span className="cm-mono text-xs font-semibold" style={{ color: '#111827' }}>{s.followers.toLocaleString()} followers</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {((profile.portfolio_images || []).length > 0 || (profile.portfolio_videos || []).length > 0) && (
          <Card>
            <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Portfolio</p>
            <div className="grid grid-cols-3 gap-2">
              {(profile.portfolio_images || []).map((img, i) => (
                <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col items-center gap-4">
          <Button className="w-full flex items-center justify-center gap-2"><Mail size={15} /> Contact</Button>
          <QRCodeBox url={profileUrl} />
        </Card>
        {profile.availability && (
          <Card>
            <p className="text-xs font-semibold mb-1" style={{ color: '#6B7280' }}>Availability</p>
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>{profile.availability}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
