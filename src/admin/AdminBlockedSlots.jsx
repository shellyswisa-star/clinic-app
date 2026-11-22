import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { DAY_NAMES, SHIFT_LABELS } from '../clinicConfig';
import { mapAdminError } from '../lib/bookingApi';

const emptyForm = {
  mode: 'recurring',
  day_index: '2',
  blocked_date: '',
  shift: 'morning',
  note: '',
};

export default function AdminBlockedSlots({ onNotice, onError }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    onError('');
    try {
      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSlots(data || []);
    } catch (err) {
      onError(mapAdminError(err, 'טעינת חסימות נכשלה. הריצי את supabase/pricing-and-blocks.sql'));
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- טעינה חד־פעמית בכניסה למסך
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    onNotice('');
    onError('');

    try {
      const payload = {
        shift: form.shift,
        note: form.note.trim() || null,
        day_index: form.mode === 'recurring' ? Number(form.day_index) : null,
        blocked_date: form.mode === 'date' ? form.blocked_date : null,
      };

      if (form.mode === 'date' && !form.blocked_date) {
        throw new Error('נא לבחור תאריך לחסימה');
      }

      const { error } = await supabase.from('blocked_slots').insert([payload]);
      if (error) throw error;

      onNotice('המשמרת נחסמה');
      setForm(emptyForm);
      await load();
    } catch (err) {
      onError(mapAdminError(err, 'הוספת חסימה נכשלה'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('להסיר את החסימה?')) return;
    onNotice('');
    onError('');
    try {
      const { error } = await supabase.from('blocked_slots').delete().eq('id', id);
      if (error) throw error;
      onNotice('החסימה הוסרה');
      await load();
    } catch (err) {
      onError(mapAdminError(err, 'מחיקת חסימה נכשלה'));
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="font-bold text-[#5c4a45]">חסימת משמרת</h2>
          <p className="text-xs text-[#8c746c]">חסימה קבועה לפי יום בשבוע, או תאריך חד־פעמי</p>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'recurring', label: 'קבוע כל שבוע' },
            { id: 'date', label: 'תאריך ספציפי' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setForm({ ...form, mode: opt.id })}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                form.mode === opt.id
                  ? 'bg-[#8c5e47] text-white border-[#8c5e47]'
                  : 'bg-white border-[#e8dfd3] text-[#5c4a45]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {form.mode === 'recurring' ? (
            <select
              value={form.day_index}
              onChange={(e) => setForm({ ...form, day_index: e.target.value })}
              className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
            >
              {DAY_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              required
              value={form.blocked_date}
              onChange={(e) => setForm({ ...form, blocked_date: e.target.value })}
              className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
            />
          )}

          <select
            value={form.shift}
            onChange={(e) => setForm({ ...form, shift: e.target.value })}
            className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
          >
            <option value="morning">בוקר</option>
            <option value="afternoon">אחה״צ</option>
            <option value="full-day">יום מלא</option>
          </select>

          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="הערה (אופציונלי)"
            className="sm:col-span-2 p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-[#8c5e47] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#724a35] disabled:bg-stone-300 cursor-pointer"
        >
          {saving ? 'שומרת...' : 'הוספת חסימה'}
        </button>
      </form>

      <div className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-[#8c746c]">טוענת חסימות...</p>
        ) : slots.length === 0 ? (
          <p className="p-6 text-sm text-[#8c746c]">אין משמרות חסומות</p>
        ) : (
          <ul className="divide-y divide-[#e8dfd3]">
            {slots.map((slot) => (
              <li key={slot.id} className="p-4 flex items-center justify-between gap-3">
                <div className="text-right space-y-0.5">
                  <p className="text-sm font-bold text-[#3b2a26]">
                    {slot.blocked_date
                      ? slot.blocked_date
                      : DAY_NAMES[slot.day_index] || `יום ${slot.day_index}`}
                    {' · '}
                    {SHIFT_LABELS[slot.shift] || slot.shift}
                  </p>
                  <p className="text-xs text-[#8c746c]">
                    {slot.blocked_date ? 'חסימה חד־פעמית' : 'חוזר כל שבוע'}
                    {slot.note ? ` · ${slot.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(slot.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  הסרה
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
