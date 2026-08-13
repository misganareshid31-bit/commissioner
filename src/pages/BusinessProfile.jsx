import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Globe, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import ProfileHeader from '../components/ProfileHeader';
import QRCodeBox from '../components/QRCodeBox';
import { Badge, Button, Card } from '../components/ui';

export default function BusinessProfile() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    supabase.from('business_profiles').select('*').eq('slug', slug).maybeSingle()
      .then(({ data }) => { if (!data) setNotFound(true); else setProfile(data); });
  }, [slug]);

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <p className="text-lg font-semibold" style={{ color: '#111827' }}>Profile not found</p>
        <Link to="/businesses" className="text-sm font-semibold mt-2 inline-block" style={{ color: '#E6007A' }}>Browse businesses</Link>
      </div>
    );
  }
  if (!profile) return <div className="max-w-2xl mx-auto px-5 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading…</div>;

  const profileUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <ProfileHeader
          name={profile.company_name}
          subtitle={profile.industry}
          city={profile.city}
          verified={profile.verified}
          photoUrl={profile.logo_url}
        >
          {profile.description && <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{profile.description}</p>}
        </ProfileHeader>

        {profile.social_links && Object.keys(profile.social_links).length > 0 && (
          <Card>
            <p className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>Links</p>
            <div className="flex flex-col gap-2">
              {Object.entries(profile.social_links).map(([k, v]) => v && (
                <a key={k} href={v} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-2" style={{ color: '#036377' }}>
                  <Globe size={14} /> {k}
                </a>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col items-center gap-4">
          <Button className="w-full flex items-center justify-center gap-2"><Mail size={15} /> Contact</Button>
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm font-semibold flex items-center gap-1" style={{ color: '#036377' }}>
              <Globe size={14} /> Visit website
            </a>
          )}
          <QRCodeBox url={profileUrl} />
        </Card>
      </div>
    </div>
  );
}
