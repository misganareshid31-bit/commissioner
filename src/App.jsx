import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthPage from './components/Auth';
import Home from './pages/Home';
import CreatorDirectory from './pages/CreatorDirectory';
import BusinessDirectory from './pages/BusinessDirectory';
import CreatorProfile from './pages/CreatorProfile';
import BusinessProfile from './pages/BusinessProfile';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import ClaimNFC from './pages/ClaimNFC';

// Supports old-style links like /?claim=CODE by redirecting to /claim/CODE,
// so previously generated/printed NFC links keep working.
function ClaimQueryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const claim = params.get('claim');
    if (claim) navigate(`/claim/${claim}`, { replace: true });
  }, [location, navigate]);
  return null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
      <ClaimQueryRedirect />
      <Navbar session={session} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/creators" element={<CreatorDirectory />} />
          <Route path="/businesses" element={<BusinessDirectory />} />
          <Route path="/creator/:username" element={<CreatorProfile />} />
          <Route path="/business/:slug" element={<BusinessProfile />} />
          <Route path="/auth" element={session ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
          <Route path="/dashboard" element={<Dashboard session={session} />} />
          <Route path="/admin" element={<Admin session={session} />} />
          <Route path="/claim/:code" element={<ClaimNFC session={session} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
