import Site from './components/Site';
import { supabaseConfigError } from './lib/supabaseClient';

export default function App() {
  if (supabaseConfigError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F4F7FD', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 480, background: '#fff', border: '1px solid #D7DFEA', borderRadius: 16, padding: 28 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#07152F', margin: 0 }}>Commissioner is not configured yet</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569', marginTop: 10 }}>{supabaseConfigError}</p>
        </div>
      </div>
    );
  }
  return <Site />;
}
