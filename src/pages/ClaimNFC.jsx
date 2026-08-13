import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Radio, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button, Card } from '../components/ui';

export default function ClaimNFC({ session }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(undefined); // undefined = loading, null = not found
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    supabase.from('nfc_cards').select('*, creator_profiles(username)').eq('card_code', code).maybeSingle()
      .then(({ data }) => setCard(data || null));
  };
  useEffect(() => { load(); }, [code]);

  // Already claimed — send the visitor straight to that creator's profile.
  useEffect(() => {
    if (card && card.creator_id && card.creator_profiles?.username) {
      navigate(`/creator/${card.creator_profiles.username}`, { replace: true });
    }
  }, [card, navigate]);

  const handleClaim = async () => {
    if (!session) return;
    setClaiming(true);
    setError('');
    const { error } = await supabase
      .from('nfc_cards')
      .update({ creator_id: session.user.id, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('card_code', code)
      .eq('status', 'unassigned'); // prevents claiming a card someone already has
    setClaiming(false);
    if (error) { setError(error.message); return; }
    load();
  };

  if (card === undefined) {
    return <div className="max-w-md mx-auto px-5 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Checking card…</div>;
  }

  if (card === null) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>Card not recognized</p>
        <p className="text-xs" style={{ color: '#6B7280' }}>This NFC card code doesn't match any card in our system.</p>
      </div>
    );
  }

  // Card exists and is unassigned — show the claim flow.
  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <Card className="text-center flex flex-col items-center gap-4">
        <div style={{ background: '#E0FBFF' }} className="w-14 h-14 rounded-full flex items-center justify-center">
          <Radio size={24} style={{ color: '#036377' }} />
        </div>
        <div>
          <p className="text-lg font-semibold" style={{ color: '#111827' }}>Activate your NFC card</p>
          <p className="cm-mono text-xs mt-1" style={{ color: '#6B7280' }}>{code}</p>
        </div>
        <p className="text-sm" style={{ color: '#374151' }}>
          This card isn't linked to a profile yet. Sign in and claim it to make it open your Commissioner profile every time it's tapped.
        </p>

        {!session ? (
          <Link to={`/auth?next=/claim/${code}`} className="w-full">
            <Button className="w-full">Sign in to claim this card</Button>
          </Link>
        ) : (
          <Button onClick={handleClaim} disabled={claiming} className="w-full flex items-center justify-center gap-2">
            <CheckCircle2 size={15} /> {claiming ? 'Claiming…' : 'Claim this card for my profile'}
          </Button>
        )}
        {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
      </Card>
    </div>
  );
}
