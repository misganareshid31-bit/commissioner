import React from 'react';

// Catches any render-time exception so a single bug shows a recoverable
// message instead of unmounting the whole app (the "black screen").
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Commissioner UI error:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 440, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#07152F', margin: 0 }}>Something went wrong on this page</h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#526078', marginTop: 10 }}>Your data is safe. Reload to continue, or go back to the homepage.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
            <button onClick={() => window.location.reload()} style={{ background: '#E6007A', color: '#fff', border: 0, borderRadius: 10, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>Reload</button>
            <button onClick={() => { window.location.href = '/'; }} style={{ background: '#fff', color: '#07152F', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}>Homepage</button>
          </div>
        </div>
      </div>
    );
  }
}
