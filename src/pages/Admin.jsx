import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Trash2, Radio, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button, Card, Input, Select } from '../components/ui';

export default function Admin({ session }) {
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState('creators');

  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    supabase.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data?.is_admin));
  }, [session]);

  if (isAdmin === null) return <div className="max-w-2xl mx-auto px-5 py-24 text-center text-sm" style={{ color: '#6B7280' }}>Checking access…</div>;
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <p className="text-sm font-semibold mb-2" style={{ color: '#111827' }}>Admin access required</p>
        <Link to="/" className="text-sm font-semibold" style={{ color: '#E6007A' }}>Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <h1 className="cm-display font-bold text-2xl mb-6" style={{ color: '#111827' }}>Admin</h1>
      <div className="flex gap-2 mb-8 border-b" style={{ borderColor: '#E5E7EB' }}>
        {['creators', 'businesses', 'nfc'].map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2.5 text-sm font-semibold capitalize border-b-2"
            style={{ color: tab === t ? '#E6007A' : '#6B7280', borderColor: tab === t ? '#E6007A' : 'transparent' }}>
            {t === 'nfc' ? 'NFC cards' : t}
          </button>
        ))}
      </div>
      {tab === 'creators' && <AdminCreators />}
      {tab === 'businesses' && <AdminBusinesses />}
      {tab === 'nfc' && <AdminNFC />}
    </div>
  );
}

function AdminCreators() {
  const [rows, setRows] = useState([]);

  const load = () => supabase.from('creator_profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const toggleVerified = async (row) => {
    await supabase.from('creator_profiles').update({ verified: !row.verified }).eq('id', row.id);
    load();
  };
  const updateField = async (id, field, value) => {
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));
  };
  const saveRow = async (row) => {
    await supabase.from('creator_profiles').update({ page_name: row.page_name, username: row.username, city: row.city, bio: row.bio }).eq('id', row.id);
    load();
  };
  const deleteRow = async (id) => {
    if (!confirm('Delete this creator profile permanently?')) return;
    await supabase.from('creator_profiles').delete().eq('id', id);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      {rows.map(row => (
        <Card key={row.id} className="flex flex-col md:flex-row md:items-center gap-3">
          <input value={row.page_name || ''} onChange={e => updateField(row.id, 'page_name', e.target.value)} placeholder="Page name" className="text-sm border-b py-1 flex-1 outline-none" style={{ borderColor: '#F3F4F6' }} />
          <input value={row.username || ''} onChange={e => updateField(row.id, 'username', e.target.value)} placeholder="username" className="text-sm border-b py-1 flex-1 outline-none" style={{ borderColor: '#F3F4F6' }} />
          <input value={row.city || ''} onChange={e => updateField(row.id, 'city', e.target.value)} placeholder="City" className="text-sm border-b py-1 w-32 outline-none" style={{ borderColor: '#F3F4F6' }} />
          <button onClick={() => saveRow(row)} className="text-xs font-semibold" style={{ color: '#036377' }}>Save</button>
          <button onClick={() => toggleVerified(row)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full" style={{ background: row.verified ? '#E9FBEF' : '#F3F4F6', color: row.verified ? '#0E7A3B' : '#6B7280' }}>
            <CheckCircle2 size={12} /> {row.verified ? 'Verified' : 'Not verified'}
          </button>
          <button onClick={() => deleteRow(row.id)}><Trash2 size={16} style={{ color: '#DC2626' }} /></button>
        </Card>
      ))}
      {rows.length === 0 && <p className="text-sm" style={{ color: '#6B7280' }}>No creator profiles yet.</p>}
    </div>
  );
}

function AdminBusinesses() {
  const [rows, setRows] = useState([]);
  const load = () => supabase.from('business_profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const toggleVerified = async (row) => {
    await supabase.from('business_profiles').update({ verified: !row.verified }).eq('id', row.id);
    load();
  };
  const deleteRow = async (id) => {
    if (!confirm('Delete this business profile permanently?')) return;
    await supabase.from('business_profiles').delete().eq('id', id);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      {rows.map(row => (
        <Card key={row.id} className="flex flex-col md:flex-row md:items-center gap-3">
          <span className="text-sm font-semibold flex-1" style={{ color: '#111827' }}>{row.company_name || '(unnamed)'}</span>
          <span className="text-xs" style={{ color: '#6B7280' }}>{row.industry}</span>
          <span className="text-xs" style={{ color: '#6B7280' }}>{row.city}</span>
          <button onClick={() => toggleVerified(row)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full" style={{ background: row.verified ? '#E9FBEF' : '#F3F4F6', color: row.verified ? '#0E7A3B' : '#6B7280' }}>
            <CheckCircle2 size={12} /> {row.verified ? 'Verified' : 'Not verified'}
          </button>
          <button onClick={() => deleteRow(row.id)}><Trash2 size={16} style={{ color: '#DC2626' }} /></button>
        </Card>
      ))}
      {rows.length === 0 && <p className="text-sm" style={{ color: '#6B7280' }}>No business profiles yet.</p>}
    </div>
  );
}

function AdminNFC() {
  const [cards, setCards] = useState([]);
  const [creators, setCreators] = useState([]);
  const [newCode, setNewCode] = useState('');

  const load = () => supabase.from('nfc_cards').select('*').order('created_at', { ascending: false }).then(({ data }) => setCards(data || []));
  useEffect(() => {
    load();
    supabase.from('creator_profiles').select('id, page_name, username').then(({ data }) => setCreators(data || []));
  }, []);

  const createCard = async () => {
    if (!newCode) return;
    await supabase.from('nfc_cards').insert({ card_code: newCode, status: 'unassigned' });
    setNewCode('');
    load();
  };
  const assignCard = async (cardId, creatorId) => {
    await supabase.from('nfc_cards').update({ creator_id: creatorId || null, status: creatorId ? 'assigned' : 'unassigned', assigned_at: creatorId ? new Date().toISOString() : null }).eq('id', cardId);
    load();
  };
  const setStatus = async (cardId, status) => {
    await supabase.from('nfc_cards').update({ status }).eq('id', cardId);
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-3">
        <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="New card code, e.g. NFC-0001" />
        <Button onClick={createCard} className="flex items-center gap-1 shrink-0"><Plus size={14} /> Create card</Button>
      </Card>
      {cards.map(card => (
        <Card key={card.id} className="flex flex-col md:flex-row md:items-center gap-3">
          <span className="cm-mono text-sm font-semibold flex items-center gap-1.5" style={{ color: '#111827' }}><Radio size={14} style={{ color: '#00A8CC' }} /> {card.card_code}</span>
          <Select value={card.creator_id || ''} onChange={e => assignCard(card.id, e.target.value)}>
            <option value="">Unassigned</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.page_name || c.username || c.id}</option>)}
          </Select>
          <Select value={card.status} onChange={e => setStatus(card.id, e.target.value)}>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Card>
      ))}
      {cards.length === 0 && <p className="text-sm" style={{ color: '#6B7280' }}>No NFC cards created yet.</p>}
    </div>
  );
}
