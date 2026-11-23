import { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { SHIFT_LABELS } from '../clinicConfig';
import { mapBookingError } from '../lib/bookingApi';
import { PLAN_LABELS, groupBookingsForList } from '../lib/bookingSeries';
import { normalizePhoneDigits } from '../lib/phone';
import { formatDateHe } from '../lib/schedule';
import { validateBookingForm } from '../lib/bookingRules';
import AlertBanner from './AlertBanner.jsx';

const STATUS_LABELS = {
  reserved: 'שריון זמני',
  paid: 'שולם',
  cancelled: 'בוטל',
  pending: 'ממתין',
};

async function fetchBookingsByPhone(phone) {
  const normalized = normalizePhoneDigits(phone);

  const rpc = await supabase.rpc('get_bookings_by_phone', { p_phone: phone });
  if (!rpc.error && Array.isArray(rpc.data)) {
    return { data: rpc.data, error: null };
  }

  // נפילה: סינון מקומי אם ה־RPC עדיין לא הותקן
  const legacy = await supabase
    .from('bookings')
    .select('*')
    .order('selected_date', { ascending: true });

  if (legacy.error) return { data: null, error: legacy.error };

  const data = (legacy.data || []).filter((b) => {
    const bNorm = normalizePhoneDigits(b.phone);
    return bNorm && bNorm === normalized;
  });
  return { data, error: null };
}

/**
 * אזור אישי ללקוחה — צפייה בהזמנות לפי מספר טלפון (ללא מסך אדמין).
 */
export default function PersonalArea({ onBack }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [searchedPhone, setSearchedPhone] = useState('');

  const rows = useMemo(
    () => (bookings ? groupBookingsForList(bookings) : []),
    [bookings],
  );

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');
    setBookings(null);

    const validation = validateBookingForm({ name: 'לקוחה', phone });
    if (validation.errors.phone) {
      setError(validation.errors.phone);
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError } = await fetchBookingsByPhone(phone);
      if (fetchError) throw fetchError;
      setBookings(data || []);
      setSearchedPhone(normalizePhoneDigits(phone));
      setExpanded(new Set());
    } catch (err) {
      setError(mapBookingError(err) || 'לא הצלחנו לטעון את ההזמנות. נסי שוב.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#fcf9f2] text-[#4a3e3d] font-sans py-8 px-4 flex justify-center"
      data-testid="personal-area"
    >
      <div className="w-full max-w-lg space-y-5">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-[#8c5e47] hover:underline cursor-pointer"
        >
          ← חזרה
        </button>

        <div className="bg-[#faf6ef] border border-[#e8dfd3] rounded-3xl shadow-xl overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="text-right space-y-1">
              <h1 className="text-2xl font-bold text-[#5c4a45] title-handwritten tracking-wide">
                האזור האישי
              </h1>
              <p className="text-xs text-[#8c746c] leading-relaxed">
                הזיני את מספר הטלפון שבו בוצעה ההזמנה כדי לראות את המועדים שלך.
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-3">
              <label className="block text-right space-y-1">
                <span className="text-[11px] font-bold text-[#8c746c]">מספר טלפון</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0501234567"
                  data-testid="personal-phone"
                  className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8c5e47]"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                data-testid="personal-lookup"
                className="w-full bg-[#8c5e47] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#724a35] disabled:bg-stone-300 cursor-pointer"
              >
                {loading ? 'טוענת...' : 'הצגת ההזמנות שלי'}
              </button>
            </form>

            {error && (
              <AlertBanner tone="error" testId="personal-error">
                {error}
              </AlertBanner>
            )}

            {bookings && bookings.length === 0 && (
              <AlertBanner tone="info" testId="personal-empty">
                לא נמצאו הזמנות למספר {searchedPhone || phone}. בדקי שהמספר זהה לזה שמילאת בהזמנה.
              </AlertBanner>
            )}

            {rows.length > 0 && (
              <ul className="divide-y divide-[#e8dfd3] border border-[#e8dfd3] rounded-2xl overflow-hidden bg-white" data-testid="personal-results">
                {rows.map((row) => {
                  const { primary, summary, isSeries } = row;
                  const open = expanded.has(row.key);
                  return (
                    <li key={row.key} className="p-4 space-y-3 text-right">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#3b2a26]">
                            {PLAN_LABELS[primary.plan_id] || primary.plan_id || 'הזמנה'}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                              primary.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : primary.status === 'cancelled'
                                  ? 'bg-stone-200 text-stone-600'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {STATUS_LABELS[primary.status] || primary.status}
                          </span>
                          {isSeries && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#f5ebe0] text-[#8c5e47]">
                              סדרה · {summary.activeCount}/{summary.total}
                            </span>
                          )}
                        </div>

                        {isSeries ? (
                          <p className="text-xs text-[#5c4a45]">
                            {formatDateHe(summary.start)} – {formatDateHe(summary.end)}
                            {' · '}
                            {summary.shiftLabel}
                            {' · '}
                            {Number(summary.totalPrice || 0).toLocaleString()} ₪
                          </p>
                        ) : (
                          <p className="text-xs text-[#5c4a45]">
                            {formatDateHe(primary.selected_date) || primary.selected_date || 'ללא תאריך'}
                            {' · '}
                            {SHIFT_LABELS[primary.selected_shift] || primary.selected_shift}
                            {' · '}
                            {Number(primary.total_price || 0).toLocaleString()} ₪
                          </p>
                        )}

                        {summary?.label && isSeries && (
                          <p className="text-[11px] text-[#8c5e47]">{summary.label}</p>
                        )}
                      </div>

                      {isSeries && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.key)}
                          className="text-xs font-bold text-[#8c5e47] hover:underline cursor-pointer"
                        >
                          {open ? 'הסתרת מועדים' : 'כל המועדים'}
                        </button>
                      )}

                      {isSeries && open && (
                        <ul className="border border-[#eee4d8] rounded-xl divide-y divide-[#eee4d8] max-h-56 overflow-y-auto">
                          {row.members.map((m) => (
                            <li key={m.id} className="px-3 py-2 text-xs flex flex-wrap gap-2 justify-between">
                              <span>
                                <span className="font-bold">
                                  {formatDateHe(m.selected_date) || m.selected_date}
                                </span>
                                {' · '}
                                {SHIFT_LABELS[m.selected_shift] || m.selected_shift}
                              </span>
                              <span className="text-[#8c746c]">
                                {STATUS_LABELS[m.status] || m.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[11px] text-[#8c746c] text-right leading-relaxed">
              לשינוי או ביטול מועד — פני בוואטסאפ או דרך המנהלת. כאן מוצגת צפייה בלבד.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
