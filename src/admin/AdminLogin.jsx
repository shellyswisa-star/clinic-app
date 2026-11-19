import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminLogin({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;
      onLoggedIn(data.session);
    } catch (err) {
      setError(err.message || 'ההתחברות נכשלה. בדקי מייל וסיסמה.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#fcf9f2] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#faf6ef] rounded-3xl shadow-xl border border-[#e8dfd3] p-8 space-y-6">
        <div className="text-right space-y-1">
          <p className="text-xs font-semibold text-[#8c5e47]">ניהול קליניקה</p>
          <h1 className="text-3xl font-bold text-[#5c4a45] title-handwritten tracking-wide">כניסת מנהלת</h1>
          <p className="text-xs text-[#8c746c]">הזמנות, ביטולים ושינויים — לשימוש פנימי בלבד</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-bold text-[#5c4a45] mb-1.5">אימייל</label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-bold text-[#5c4a45] mb-1.5">סיסמה</label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#faf8f5] text-[#4a3e3d] focus:outline-none focus:ring-2 focus:ring-[#8c5e47]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#8c5e47] text-[#faf4eb] py-3.5 rounded-xl font-bold text-sm hover:bg-[#724a35] transition-colors shadow-md disabled:bg-stone-300 cursor-pointer"
          >
            {isLoading ? 'מתחברת...' : 'כניסה לדשבורד'}
          </button>
        </form>
      </div>
    </div>
  );
}
