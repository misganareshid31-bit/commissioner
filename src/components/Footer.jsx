import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{ background: '#111827' }} className="text-white mt-24">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg cm-beam flex items-center justify-center">
            <span className="cm-display text-white font-bold text-sm">C</span>
          </div>
          <span className="cm-display font-bold text-lg">Commissioner</span>
        </div>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Where creators and businesses connect professionally.</p>
        <div className="flex gap-5 text-sm" style={{ color: '#9CA3AF' }}>
          <Link to="/creators">Creators</Link>
          <Link to="/businesses">Businesses</Link>
        </div>
      </div>
      <div className="border-t px-5 md:px-8 py-5" style={{ borderColor: '#1F2937' }}>
        <p className="text-xs text-center" style={{ color: '#6B7280' }}>© 2026 Commissioner. All rights reserved.</p>
      </div>
    </footer>
  );
}
