import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { supabaseConfigured } from './lib/supabaseClient';
import './index.css';

function Unavailable() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#FFFFFF', color: '#07152F', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Commissioner is temporarily unavailable</h1>
        <p style={{ marginTop: 8, color: '#334155' }}>Please try again shortly.</p>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>{supabaseConfigured ? <App /> : <Unavailable />}</ErrorBoundary>
  </React.StrictMode>
);
