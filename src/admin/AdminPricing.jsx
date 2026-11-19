import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { DEFAULT_PRICING } from '../clinicConfig';

export default function AdminPricing({ onNotice, onError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    onError('');
    try {
      const { data, error } = await supabase
        .from('pricing')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setRows(data?.length ? data : DEFAULT_PRICING.map((r) => ({ ...r })));
    } catch (err) {
      onError(err.message || 'טעינת מחירים נכשלה. הריצי את supabase/pricing-and-blocks.sql');
      setRows(DEFAULT_PRICING.map((r) => ({ ...r })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateAmount = (id, amount) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, amount } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    onNotice('');
    onError('');

    try {
      const payload = rows.map((row) => ({
        id: row.id,
        label: row.label,
        amount: Number(row.amount) || 0,
        sort_order: row.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('pricing').upsert(payload);
      if (error) throw error;
      onNotice('המחירים נשמרו ויופיעו באתר ההזמנות');
      await load();
    } catch (err) {
      onError(err.message || 'שמירת מחירים נכשלה');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[#8c746c]">טוענת מחירים...</p>;
  }

  return (
    <form onSubmit={handleSave} className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl p-4 space-y-4">
      <div>
        <h2 className="font-bold text-[#5c4a45]">מחירון</h2>
        <p className="text-xs text-[#8c746c]">השינויים מתעדכנים באתר ההזמנות אחרי שמירה</p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_120px] gap-3 items-center bg-white border border-[#e8dfd3] rounded-xl p-3"
          >
            <div className="text-right">
              <p className="text-sm font-bold text-[#3b2a26]">{row.label}</p>
              <p className="text-[11px] text-[#8c746c]">{row.id}</p>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={row.amount}
                onChange={(e) => updateAmount(row.id, e.target.value)}
                className="w-full p-2 border border-[#cbd5e1] rounded-lg text-sm text-left"
              />
              <span className="text-xs text-[#8c746c]">₪</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-[#8c5e47] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#724a35] disabled:bg-stone-300 cursor-pointer"
      >
        {saving ? 'שומרת...' : 'שמירת מחירים'}
      </button>
    </form>
  );
}
