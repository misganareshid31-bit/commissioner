from pathlib import Path
p=Path('src/components/Site.jsx')
s=p.read_text()
s=s.replace("select('id, page_name, username, avatar_url, city, primary_niche, platforms, services, verified')", "select('id, auth_user_id, page_name, username, avatar_url, city, primary_niche, platforms, services, verified')")
start=s.index('const Messages = () => {')
end=s.index('\nconst StatCard =', start)
new=r'''const Messages = ({ session, initialRecipientId = null }) => {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadConversations = async () => {
    if (!session?.user?.id) { setConversations([]); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('list_my_conversations');
    if (rpcError) {
      setError(rpcError.message || 'Could not load your messages.');
      setConversations([]);
    } else {
      setConversations(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  const loadThread = async (conversationId) => {
    if (!conversationId) return;
    setThreadLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('get_conversation_messages', { p_conversation_id: conversationId });
    if (rpcError) setError(rpcError.message || 'Could not load this conversation.');
    else setMessages(Array.isArray(data) ? data : []);
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c));
    setThreadLoading(false);
  };

  useEffect(() => { loadConversations(); }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const channel = supabase
      .channel(`messages:${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const row = payload.new;
        if (row.sender_id === session.user.id || conversations.some(c => c.id === row.conversation_id)) {
          await loadConversations();
          if (active === row.conversation_id) {
            await loadThread(row.conversation_id);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, active, conversations.length]);

  useEffect(() => {
    if (!initialRecipientId || !session?.user?.id || initialRecipientId === session.user.id) return;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('start_conversation', {
        p_other_user_id: initialRecipientId,
        p_initial_message: null,
      });
      if (rpcError) { setError(rpcError.message || 'Could not start the conversation.'); return; }
      await loadConversations();
      setActive(data);
      await loadThread(data);
    })();
  }, [initialRecipientId, session?.user?.id]);

  const selectConversation = async (id) => { setActive(id); await loadThread(id); };
  const activeConvo = conversations.find(c => c.id === active);
  const filtered = conversations.filter(c => (c.other_name || '').toLowerCase().includes(search.toLowerCase()));

  const send = async () => {
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('send_message', {
      p_conversation_id: active,
      p_body: body,
    });
    if (rpcError) setError(rpcError.message || 'Could not send the message.');
    else {
      setDraft('');
      if (data) setMessages(prev => [...prev, data]);
      await loadConversations();
    }
    setSending(false);
  };

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 text-center">
        <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#00A8CC' }} />
        <h1 className="cm-display font-bold text-2xl mb-2" style={{ color: '#111827' }}>Messages</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>Sign in to message creators and businesses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="cm-display font-bold text-2xl md:text-3xl" style={{ color: '#111827' }}>Messages</h1><p className="text-xs mt-1" style={{ color: '#6B7280' }}>Private conversations between Commissioner members.</p></div>
        {error && <span className="text-xs max-w-sm text-right" style={{ color: '#B42318' }}>{error}</span>}
      </div>
      <div className="bg-white border rounded-2xl overflow-hidden flex flex-col md:flex-row" style={{ borderColor: '#E5E7EB', height: '600px' }}>
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <div className="p-3 border-b" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2" style={{ borderColor: '#E5E7EB', background: '#F8FAFC' }}>
              <Search size={14} style={{ color: '#6B7280' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages" className="flex-1 outline-none text-xs bg-transparent" />
            </div>
          </div>
          <div className="overflow-y-auto cm-scroll flex-1">
            {loading ? <p className="p-6 text-center text-xs" style={{ color: '#6B7280' }}>Loading conversations…</p> : filtered.length === 0 ? (
              <div className="p-6 text-center"><MessageSquare size={22} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} /><p className="text-xs" style={{ color: '#6B7280' }}>No conversations yet. Open a creator profile and choose Message to start one.</p></div>
            ) : filtered.map(c => (
              <button key={c.id} onClick={() => selectConversation(c.id)} className="w-full text-left flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#F3F4F6', background: active === c.id ? '#FDE7F1' : 'white' }}>
                <Avatar name={c.other_name || 'Member'} size={40} tone={c.tone || 0} src={c.other_avatar_url} />
                <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{c.other_name || 'Commissioner member'}</p><span className="text-[11px] shrink-0" style={{ color: '#9CA3AF' }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ''}</span></div><p className="text-xs truncate" style={{ color: c.unread_count ? '#111827' : '#6B7280', fontWeight: c.unread_count ? 600 : 400 }}>{c.last_message || 'No messages yet'}</p></div>
                {c.unread_count > 0 && <span style={{ background: '#E6007A' }} className="min-w-5 h-5 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread_count}</span>}
              </button>
            ))}
          </div>
        </div>
        {!activeConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6"><MessageSquare size={28} style={{ color: '#D1D5DB' }} /><p className="text-sm font-semibold" style={{ color: '#111827' }}>No conversation selected</p><p className="text-xs" style={{ color: '#6B7280' }}>Message a creator or business from their profile to start a conversation.</p></div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: '#E5E7EB' }}><div className="flex items-center gap-3"><Avatar name={activeConvo.other_name || 'Member'} size={36} tone={activeConvo.tone || 0} src={activeConvo.other_avatar_url} /><div><p className="text-sm font-semibold" style={{ color: '#111827' }}>{activeConvo.other_name || 'Commissioner member'}</p><p className="text-[11px]" style={{ color: '#6B7280' }}>{activeConvo.other_type === 'business' ? 'Business' : 'Creator'}</p></div></div><button style={{ background: '#E0FBFF', color: '#036377' }} className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5"><Briefcase size={13} /> Campaign workspace</button></div>
            <div className="flex-1 overflow-y-auto cm-scroll px-5 py-5 flex flex-col gap-3" style={{ background: '#F8FAFC' }}>
              {threadLoading ? <p className="text-center text-xs" style={{ color: '#6B7280' }}>Loading…</p> : messages.map(m => {
                const mine = m.sender_id === session.user.id;
                return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[78%] px-4 py-2.5 rounded-2xl text-sm" style={{ background: mine ? '#E6007A' : 'white', color: mine ? 'white' : '#111827', border: mine ? 'none' : '1px solid #E5E7EB', borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6 }}><p className="whitespace-pre-wrap break-words">{m.body}</p><p className="text-[10px] mt-1 opacity-70 text-right">{new Date(m.created_at).toLocaleString()}</p></div></div>;
              })}
            </div>
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: '#E5E7EB' }}><button type="button" style={{ color: '#00A8CC' }} title="Attachments are coming next"><Paperclip size={18} /></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message" className="flex-1 outline-none text-sm px-2" maxLength={4000} /><button type="submit" disabled={sending || !draft.trim()} style={{ background: '#E6007A', opacity: sending || !draft.trim() ? .5 : 1 }} className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"><Send size={15} /></button></form>
          </div>
        )}
      </div>
    </div>
  );
};
'''
s=s[:start]+new+s[end:]
# Replace onHire with async starter
old="""  const onHire = (creator) => {\n    if (!session) { setPage('auth'); return; }\n    setToast(`Message sent to ${creator.name} — they typically respond in ${creator.response}.`);\n    setTimeout(() => setToast(''), 3000);\n  };"""
new_on="""  const [messageRecipientId, setMessageRecipientId] = useState(null);\n  const onHire = async (creator) => {\n    if (!session) { setPage('auth'); return; }\n    if (!creator.authUserId) { setToast('This creator has not connected a messaging account yet.'); setTimeout(() => setToast(''), 3000); return; }\n    setMessageRecipientId(creator.authUserId);\n    setPage('messages');\n  };"""
if old not in s: raise SystemExit('onHire pattern not found')
s=s.replace(old,new_on)
s=s.replace("      response: null,\n      tone: i,", "      response: null,\n      authUserId: row.auth_user_id,\n      tone: i,")
s=s.replace("{page === 'messages' && <Messages />}", "{page === 'messages' && <Messages session={session} initialRecipientId={messageRecipientId} />}")
p.write_text(s)
