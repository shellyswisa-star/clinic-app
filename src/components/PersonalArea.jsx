import { useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { SHIFT_LABELS } from '../clinicConfig';
import { mapPersonalOtpError } from '../lib/bookingApi';
import { PLAN_LABELS, groupBookingsForList } from '../lib/bookingSeries';
import { normalizePhoneDigits, toE164Israel } from '../lib/phone';
import { formatDateHe } from '../lib/schedule';
import { validateBookingForm } from '../lib/bookingRules';
import AlertBanner from './AlertBanner.jsx';

const STATUS_LABELS = {
  reserved: 'שריון זמני',
  paid: 'שולם',
  cancelled: 'בוטל',
  pending: 'ממתין',
};

async function signOutPhoneSessionIfNeeded() {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    // לא מנתקים מנהלת (אימייל) — רק סשן טלפון של אזור אישי
    if (user?.phone && !user?.email) {
      await supabase.auth.signOut();
    }
  } catch {
    // ignore
  }
}

async function loadMyBookings() {
  const rpc = await supabase.rpc('get_my_bookings');
  if (!rpc.error && Array.isArray(rpc.data)) {
    return { data: rpc.data, error: null };
  }

  // נפילה: אם ה־RPC עדיין לא הותקן — סינון לפי טלפון מהסשן
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { data: null, error: userError };
  const authPhone = userData.user?.phone;
  if (!authPhone) {
    return { data: null, error: { message: 'not_authenticated' } };
  }

  const normalized = normalizePhoneDigits(authPhone);
  const legacy = await supabase
    .from('bookings')
    .select('*')
    .order('selected_date', { ascending: true });
  if (legacy.error) return { data: null, error: legacy.error };

  const data = (legacy.data || []).filter(
    (b) => normalizePhoneDigits(b.phone) === normalized,
  );
  return { data, error: null };
}

/**
 * אזור אישי — כניסה עם קוד SMS (Supabase Phone OTP), צפייה בהזמנות בלבד.
 */
export default function PersonalArea({ onBack }) {
  const [phase, setPhase] = useState('phone'); // phone | code | done
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [e164, setE164] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookings, setBookings] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [displayPhone, setDisplayPhone] = useState('');

  const rows = useMemo(
    () => (bookings ? groupBookingsForList(bookings) : []),
    [bookings],
  );

  const handleBack = async () => {
    await signOutPhoneSessionIfNeeded();
    onBack();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBookings(null);

    const validation = validateBookingForm({ name: 'לקוחה', phone });
    if (validation.errors.phone) {
      setError(validation.errors.phone);
      return;
    }

    const formatted = toE164Israel(phone);
    if (!formatted) {
      setError('מספר טלפון אינו תקין (לדוגמה: 0501234567)');
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formatted,
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;

      setE164(formatted);
      setDisplayPhone(normalizePhoneDigits(phone));
      setPhase('code');
      setOtp('');
      setNotice('נשלח אלייך קוד ב־SMS. הזיני אותו כאן.');
    } catch (err) {
      setError(mapPersonalOtpError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const code = otp.replace(/\D/g, '');
    if (code.length < 6) {
      setError('הזיני את הקוד בן 6 הספרות שנשלח ב־SMS.');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: 'sms',
      });
      if (verifyError) throw verifyError;

      const { data, error: fetchError } = await loadMyBookings();
      if (fetchError) throw fetchError;

      setBookings(data || []);
      setExpanded(new Set());
      setPhase('done');
      setNotice('');
    } catch (err) {
      setError(mapPersonalOtpError(err));
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
      data-phase={phase}
    >
      <div className="w-full max-w-lg space-y-5">
        <button
          type="button"
          onClick={handleBack}
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
                {phase === 'phone' &&
                  'הזיני את מספר הטלפון שבו בוצעה ההזמנה — נשלח אלייך קוד לאימות.'}
                {phase === 'code' &&
                  `הזיני את הקוד שנשלח ב־SMS למספר ${displayPhone}.`}
                {phase === 'done' &&
                  `מאומתת · ${displayPhone}. להלן ההזמנות שלך.`}
              </p>
            </div>

            {phase === 'phone' && (
              <form onSubmit={handleSendOtp} className="space-y-3" data-testid="personal-phone-form">
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
                  data-testid="personal-send-otp"
                  className="w-full bg-[#8c5e47] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#724a35] disabled:bg-stone-300 cursor-pointer"
                >
                  {loading ? 'שולחת קוד...' : 'שליחת קוד ב־SMS'}
                </button>
              </form>
            )}

            {phase === 'code' && (
              <form onSubmit={handleVerifyOtp} className="space-y-3" data-testid="personal-code-form">
                <label className="block text-right space-y-1">
                  <span className="text-[11px] font-bold text-[#8c746c]">קוד אימות</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6 ספרות"
                    data-testid="personal-otp"
                    className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-[#8c5e47]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="personal-verify-otp"
                  className="w-full bg-[#8c5e47] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#724a35] disabled:bg-stone-300 cursor-pointer"
                >
                  {loading ? 'מאמתת...' : 'אימות והצגת הזמנות'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setPhase('phone');
                    setOtp('');
                    setError('');
                    setNotice('');
                  }}
                  className="w-full text-xs font-semibold text-[#8c5e47] hover:underline cursor-pointer py-1"
                >
                  שינוי מספר טלפון
                </button>
              </form>
            )}

            {notice && !error && (
              <AlertBanner tone="info" testId="personal-notice">
                {notice}
              </AlertBanner>
            )}

            {error && (
              <AlertBanner tone="error" testId="personal-error">
                {error}
              </AlertBanner>
            )}

            {phase === 'done' && bookings && bookings.length === 0 && (
              <AlertBanner tone="info" testId="personal-empty">
                לא נמצאו הזמנות למספר {displayPhone}. בדקי שהמספר זהה לזה שמילאת בהזמנה.
              </AlertBanner>
            )}

            {phase === 'done' && rows.length > 0 && (
              <ul
                className="divide-y divide-[#e8dfd3] border border-[#e8dfd3] rounded-2xl overflow-hidden bg-white"
                data-testid="personal-results"
              >
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
                            <li
                              key={m.id}
                              className="px-3 py-2 text-xs flex flex-wrap gap-2 justify-between"
                            >
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
