import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import AdminLogin from './AdminLogin.jsx';
import AdminDashboard from './AdminDashboard.jsx';

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setChecking(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#fcf9f2] flex items-center justify-center text-sm text-[#8c746c]">
        טוענת...
      </div>
    );
  }

  if (!session) {
    return <AdminLogin onLoggedIn={setSession} />;
  }

  return (
    <AdminDashboard
      session={session}
      onLogout={() => setSession(null)}
    />
  );
}
