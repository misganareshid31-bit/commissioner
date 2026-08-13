import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Plus, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button, Input, Select, Card } from '../components/ui';

const NICHES = ['Food & Restaurants', 'Fashion', 'Beauty', 'Technology', 'Gaming', 'Fitness', 'Travel', 'Comedy'];
const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Telegram'];

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function Dashboard({ session }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { setRole(data?.role || 'creator'); setLoading(false); });
  }, [session]);

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <p className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>Sign in to view your dashboard</p>
        <Link to="/auth" className="text-sm font-semibold" style={{ color: '#E6007A' }}>Go to sign in</Link>
      </div>
    );
  }
  if (loading) return <div className="max-w-2xl mx-auto px-5 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Loading…</div>;

  return role === 'business' ? <BusinessDashboard session={session} /> : <CreatorDashboard session={session} />;
}

function CreatorDashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [socials, setSocials] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('creator_profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data));
    supabase.from('social_accounts').select('*').eq('creator_id', session.user.id).then(({ data }) => setSocials(data || []));
  }, [session]);

  const update = (field, value) => setProfile(p => ({ ...p, [field]: value }));

  const uploadImage = async (file, bucket, field) => {
    const path = `${session.user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { setError(error.message); return; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    update(field, data.publicUrl);
  };

  const addSocial = () => setSocials(s => [...s, { platform: 'Instagram', handle: '', followers: '', engagement: '', _new: true }]);
  const updateSocial = (i, field, value) => setSocials(s => s.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  const removeSocial = async (i) => {
    const row = socials[i];
    if (row.id) await supabase.from('social_accounts').delete().eq('id', row.id);
    setSocials(s => s.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    if (!profile.username) { setError('Choose a username first — it becomes your public profile URL.'); setSaving(false); return; }
    const { error: pErr } = await supabase.from('creator_profiles').update({
      username: slugify(profile.username),
      page_name: profile.page_name,
      city: profile.city,
      language: profile.language,
      bio: profile.bio,
      primary_niche: profile.primary_niche || null,
      availability: profile.availability,
      professional_preferences: profile.professional_preferences,
      profile_photo_url: profile.profile_photo_url,
      cover_image_url: profile.cover_image_url,
      portfolio_link: profile.portfolio_link,
    }).eq('id', session.user.id);
    if (pErr) { setError(pErr.message); setSaving(false); return; }

    for (const row of socials) {
      const payload = { creator_id: session.user.id, platform: row.platform, handle: row.handle, followers: row.followers ? Number(row.followers) : null, engagement: row.engagement ? Number(row.engagement) : null };
      if (row.id) await supabase.from('social_accounts').update(payload).eq('id', row.id);
      else await supabase.from('social_accounts').insert(payload);
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="cm-display font-bold text-2xl" style={{ color: '#111827' }}>Your creator profile</h1>
        {profile.username && (
          <Link to={`/creator/${profile.username}`} target="_blank" className="text-sm font-semibold flex items-center gap-1" style={{ color: '#036377' }}>
            View public page <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <Card className="flex flex-col gap-5 mb-6">
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Basic info</p>
        <Input label="Username (your public URL — commissioner.app/creator/username)" value={profile.username || ''} onChange={e => update('username', e.target.value)} placeholder="e.g. taste-and-tell" />
        <Input label="Page name" value={profile.page_name || ''} onChange={e => update('page_name', e.target.value)} placeholder="e.g. Taste & Tell" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" value={profile.city || ''} onChange={e => update('city', e.target.value)} />
          <Input label="Language" value={profile.language || ''} onChange={e => update('language', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Bio</label>
          <textarea value={profile.bio || ''} onChange={e => update('bio', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
        </div>
        <Select label="Primary niche (optional)" value={profile.primary_niche || ''} onChange={e => update('primary_niche', e.target.value)}>
          <option value="">Not specified</option>
          {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
        </Select>
        <Select label="Availability" value={profile.availability || 'Available now'} onChange={e => update('availability', e.target.value)}>
          <option>Available now</option>
          <option>Limited availability</option>
          <option>Not currently available</option>
        </Select>
      </Card>

      <Card className="flex flex-col gap-4 mb-6">
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>Photos</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Profile photo</label>
            <input type="file" accept="image/*" onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'profile-photos', 'profile_photo_url')} className="text-xs" />
            {profile.profile_photo_url && <img src={profile.profile_photo_url} alt="" className="w-16 h-16 rounded-full object-cover mt-2" />}
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Cover / banner image</label>
            <input type="file" accept="image/*" onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'profile-photos', 'cover_image_url')} className="text-xs" />
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: '#111827' }}>Social media</p>
          <button onClick={addSocial} className="text-xs font-semibold flex items-center gap-1" style={{ color: '#E6007A' }}><Plus size={13} /> Add platform</button>
        </div>
        {socials.map((s, i) => (
          <div key={s.id || i} className="flex items-center gap-2 border rounded-lg p-3" style={{ borderColor: '#E5E7EB' }}>
            <Select value={s.platform} onChange={e => updateSocial(i, 'platform', e.target.value)}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            <input placeholder="@handle" value={s.handle || ''} onChange={e => updateSocial(i, 'handle', e.target.value)} className="text-sm outline-none border-b py-1 flex-1" style={{ borderColor: '#F3F4F6' }} />
            <input placeholder="Followers" type="number" value={s.followers || ''} onChange={e => updateSocial(i, 'followers', e.target.value)} className="text-sm outline-none border-b py-1 w-24" style={{ borderColor: '#F3F4F6' }} />
            <input placeholder="Eng. %" type="number" value={s.engagement || ''} onChange={e => updateSocial(i, 'engagement', e.target.value)} className="text-sm outline-none border-b py-1 w-20" style={{ borderColor: '#F3F4F6' }} />
            <button onClick={() => removeSocial(i)}><Trash2 size={15} style={{ color: '#DC2626' }} /></button>
          </div>
        ))}
      </Card>

      {error && <p className="text-xs mb-3" style={{ color: '#DC2626' }}>{error}</p>}
      {saved && <p className="text-xs mb-3" style={{ color: '#0E7A3B' }}>Saved.</p>}
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
    </div>
  );
}

function BusinessDashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('business_profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [session]);

  const update = (field, value) => setProfile(p => ({ ...p, [field]: value }));

  const uploadLogo = async (file) => {
    const path = `${session.user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('business-logos').upload(path, file, { upsert: true });
    if (error) { setError(error.message); return; }
    const { data } = supabase.storage.from('business-logos').getPublicUrl(path);
    update('logo_url', data.publicUrl);
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    if (!profile.slug) { setError('Choose a URL slug first — it becomes your public profile URL.'); setSaving(false); return; }
    const { error: pErr } = await supabase.from('business_profiles').update({
      slug: slugify(profile.slug),
      company_name: profile.company_name,
      industry: profile.industry,
      city: profile.city,
      description: profile.description,
      website: profile.website,
      logo_url: profile.logo_url,
      social_links: profile.social_links || {},
    }).eq('id', session.user.id);
    setSaving(false);
    if (pErr) { setError(pErr.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="cm-display font-bold text-2xl" style={{ color: '#111827' }}>Your business profile</h1>
        {profile.slug && (
          <Link to={`/business/${profile.slug}`} target="_blank" className="text-sm font-semibold flex items-center gap-1" style={{ color: '#036377' }}>
            View public page <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <Card className="flex flex-col gap-5 mb-6">
        <Input label="URL slug (commissioner.app/business/slug)" value={profile.slug || ''} onChange={e => update('slug', e.target.value)} placeholder="e.g. northfield-coffee" />
        <Input label="Company name" value={profile.company_name || ''} onChange={e => update('company_name', e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Industry" value={profile.industry || ''} onChange={e => update('industry', e.target.value)} />
          <Input label="City" value={profile.city || ''} onChange={e => update('city', e.target.value)} />
        </div>
        <Input label="Website" value={profile.website || ''} onChange={e => update('website', e.target.value)} placeholder="https://" />
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Description</label>
          <textarea value={profile.description || ''} onChange={e => update('description', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>Logo</label>
          <input type="file" accept="image/*" onChange={e => e.target.files[0] && uploadLogo(e.target.files[0])} className="text-xs" />
          {profile.logo_url && <img src={profile.logo_url} alt="" className="w-16 h-16 rounded-lg object-cover mt-2" />}
        </div>
      </Card>

      {error && <p className="text-xs mb-3" style={{ color: '#DC2626' }}>{error}</p>}
      {saved && <p className="text-xs mb-3" style={{ color: '#0E7A3B' }}>Saved.</p>}
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
    </div>
  );
}
