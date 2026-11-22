import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SHIFT_LABELS } from '../clinicConfig';
import { mapAdminError, mapBookingError } from '../lib/bookingApi';
import { validateAdminBookingEdit } from '../lib/bookingRules';
import AlertBanner from '../components/AlertBanner.jsx';
import AdminPricing from './AdminPricing.jsx';
import AdminBlockedSlots from './AdminBlockedSlots.jsx';
import AdminBookingsCalendar from './AdminBookingsCalendar.jsx';

const STATUS_LABELS = {
  reserved: 'שריון זמני',
  paid: 'שולם',
  cancelled: 'בוטל',
  pending: 'ממתין',
};

const TABS = [
  { id: 'bookings', label: 'הזמנות' },
  { id: 'pricing', label: 'מחירים' },
  { id: 'blocks', label: 'חסימת משמרות' },
];

const emptyEdit = {
  id: null,
  full_name: '',
  phone: '',
  profession: '',
  selected_date: '',
  selected_shift: 'morning',
  total_price: '',
  status: 'reserved',
  plan_id: '',
};

export default function AdminDashboard({ session, onLogout }) {
  const [tab, setTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState('none'); // none | created | selected
  const [dateFilterValue, setDateFilterValue] = useState('');
  const [viewMode, setViewMode] = useState('calendar');
  const [editForm, setEditForm] = useState(emptyEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data, error: fetchError }, blockedRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('blocked_slots').select('*'),
      ]);

      if (fetchError) throw fetchError;
      setBookings(data || []);

      if (blockedRes.error) {
        console.error(blockedRes.error);
        setError(mapAdminError(blockedRes.error, 'טעינת חסימות נכשלה'));
      } else {
        setBlockedSlots(blockedRes.data || []);
      }
    } catch (err) {
      setError(mapAdminError(err, 'לא הצלחנו לטעון הזמנות'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'bookings') fetchBookings();
  }, [tab]);

  const latestCreated = useMemo(() => bookings[0] || null, [bookings]);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      const statusOk = statusFilter === 'all' || b.status === statusFilter;
      if (!statusOk) return false;

      if (dateFilterMode !== 'none' && dateFilterValue) {
        if (dateFilterMode === 'selected') {
          if (b.selected_date !== dateFilterValue) return false;
        } else if (dateFilterMode === 'created') {
          const createdDay = b.created_at ? String(b.created_at).slice(0, 10) : '';
          if (createdDay !== dateFilterValue) return false;
        }
      }

      if (!q) return true;
      return (
        (b.full_name || '').toLowerCase().includes(q) ||
        (b.phone || '').includes(q) ||
        (b.plan_id || '').toLowerCase().includes(q)
      );
    });
  }, [bookings, statusFilter, search, dateFilterMode, dateFilterValue]);

  const switchViewMode = (mode) => {
    setViewMode(mode);
    setEditForm(emptyEdit);
    setError('');
    setNotice('');
  };

  const openEdit = (booking) => {
    setNotice('');
    setError('');
    setEditForm({
      id: booking.id,
      full_name: booking.full_name || '',
      phone: booking.phone || '',
      profession: booking.profession || '',
      selected_date: booking.selected_date || '',
      selected_shift: booking.selected_shift || 'morning',
      total_price: booking.total_price ?? '',
      status: booking.status || 'reserved',
      plan_id: booking.plan_id || '',
    });
    // אחרי בחירה מהיומן — גלגלי למעלה לטופס העריכה
    setTimeout(() => {
      document.getElementById('admin-edit-booking')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  };

  const closeEdit = () => {
    setEditForm(emptyEdit);
    setError('');
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => {
      const el =
        document.querySelector('[data-testid="admin-edit-error"]') ||
        document.querySelector('[data-testid="admin-error"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.id) return;
    setIsSaving(true);
    setNotice('');
    setError('');

    const validation = validateAdminBookingEdit(editForm);
    if (!validation.ok) {
      showError(validation.message);
      setIsSaving(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim(),
          profession: editForm.profession.trim(),
          selected_date: editForm.selected_date || null,
          selected_shift: editForm.selected_shift,
          total_price: Number(editForm.total_price) || 0,
          status: editForm.status,
          plan_id: editForm.plan_id,
        })
        .eq('id', editForm.id);

      if (updateError) throw updateError;
      setNotice('ההזמנה עודכנה');
      closeEdit();
      await fetchBookings();
    } catch (err) {
      showError(mapBookingError(err) || 'עדכון ההזמנה נכשל');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelBooking = async (booking) => {
    if (!window.confirm(`לבטל את ההזמנה של ${booking.full_name || 'הלקוחה'}?`)) return;
    setError('');
    setNotice('');

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (updateError) throw updateError;
      setNotice('ההזמנה בוטלה');
      if (editForm.id === booking.id) closeEdit();
      await fetchBookings();
    } catch (err) {
      showError(mapBookingError(err) || 'ביטול ההזמנה נכשל');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#fcf9f2] text-[#4a3e3d]">
      <header className="bg-[#faf6ef] border-b border-[#e8dfd3] px-4 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold title-handwritten tracking-wide text-[#5c4a45]">דשבורד מנהלת</h1>
            <p className="text-xs text-[#8c746c]">{session?.user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-xs font-semibold text-[#8c5e47] hover:underline px-3 py-2"
            >
              לאתר ההזמנות
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold bg-white border border-[#e8dfd3] px-3 py-2 rounded-xl hover:bg-[#f5ebe0] cursor-pointer"
            >
              התנתקות
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setEditForm(emptyEdit);
                setNotice('');
                setError('');
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border cursor-pointer ${
                tab === item.id
                  ? 'bg-[#8c5e47] text-white border-[#8c5e47]'
                  : 'bg-white text-[#5c4a45] border-[#e8dfd3] hover:bg-[#f5ebe0]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
        {/* כשטופס העריכה פתוח — השגיאה מוצגת לידו בלבד, בלי כפילות */}
        {error && !editForm.id && (
          <AlertBanner tone="error" testId="admin-error">{error}</AlertBanner>
        )}

        {tab === 'pricing' && (
          <AdminPricing onNotice={setNotice} onError={setError} />
        )}

        {tab === 'blocks' && (
          <AdminBlockedSlots onNotice={setNotice} onError={setError} />
        )}

        {tab === 'bookings' && (
          <>
            {latestCreated && (
              <div
                data-testid="admin-latest-booking"
                className="bg-white border border-[#e8dfd3] rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="text-right space-y-0.5">
                  <p className="text-[11px] font-bold text-[#8c5e47]">הזמנה אחרונה שנכנסה</p>
                  <p className="text-sm font-bold text-[#3b2a26]">
                    {latestCreated.full_name || 'ללא שם'}
                    <span className="text-xs font-semibold text-[#8c746c] mr-2">
                      · {STATUS_LABELS[latestCreated.status] || latestCreated.status}
                    </span>
                  </p>
                  <p className="text-[11px] text-[#8c746c]">
                    מועד: {latestCreated.selected_date || '—'}
                    {latestCreated.created_at
                      ? ` · נקלטה: ${new Date(latestCreated.created_at).toLocaleString('he-IL')}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(latestCreated)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#8c5e47] text-white hover:bg-[#724a35] cursor-pointer shrink-0"
                >
                  פתיחה לעריכה
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-1 bg-white border border-[#e8dfd3] rounded-xl p-1">
                  {[
                    { id: 'calendar', label: 'יומן' },
                    { id: 'list', label: 'רשימה' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => switchViewMode(mode.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                        viewMode === mode.id
                          ? 'bg-[#8c5e47] text-white'
                          : 'text-[#5c4a45] hover:bg-[#f5ebe0]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש לפי שם, טלפון או מסלול..."
                  className="flex-1 p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8c5e47]"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8c5e47]"
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="reserved">שריון זמני</option>
                  <option value="paid">שולם</option>
                  <option value="cancelled">בוטל</option>
                </select>
                <button
                  type="button"
                  onClick={fetchBookings}
                  className="px-4 py-3 rounded-xl text-sm font-bold bg-[#8c5e47] text-white hover:bg-[#724a35] cursor-pointer"
                >
                  רענון
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <label className="text-xs font-bold text-[#5c4a45] shrink-0">סינון לפי תאריך:</label>
                <select
                  value={dateFilterMode}
                  onChange={(e) => setDateFilterMode(e.target.value)}
                  className="p-2.5 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  data-testid="admin-date-filter-mode"
                >
                  <option value="none">ללא</option>
                  <option value="created">תאריך קליטת הזמנה</option>
                  <option value="selected">תאריך המועד ביומן</option>
                </select>
                <input
                  type="date"
                  value={dateFilterValue}
                  disabled={dateFilterMode === 'none'}
                  onChange={(e) => setDateFilterValue(e.target.value)}
                  className="p-2.5 border border-[#cbd5e1] rounded-xl text-sm bg-white disabled:opacity-50"
                  data-testid="admin-date-filter-value"
                />
              </div>
            </div>

            {editForm.id && (
              <form
                id="admin-edit-booking"
                onSubmit={handleSaveEdit}
                className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-[#5c4a45]">עריכת הזמנה</h2>
                  <button type="button" onClick={closeEdit} className="text-xs text-[#8c746c] hover:underline cursor-pointer">
                    סגירה
                  </button>
                </div>

                {error && (
                  <AlertBanner tone="error" testId="admin-edit-error">
                    {error}
                  </AlertBanner>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    placeholder="שם מלא"
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  />
                  <input
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="טלפון"
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  />
                  <input
                    value={editForm.profession}
                    onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                    placeholder="תחום טיפול"
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  />
                  <input
                    value={editForm.plan_id}
                    onChange={(e) => setEditForm({ ...editForm, plan_id: e.target.value })}
                    placeholder="מסלול (plan_id)"
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  />
                  <input
                    type="date"
                    value={editForm.selected_date}
                    onChange={(e) => setEditForm({ ...editForm, selected_date: e.target.value })}
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  />
                  <select
                    value={editForm.selected_shift}
                    onChange={(e) => setEditForm({ ...editForm, selected_shift: e.target.value })}
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  >
                    <option value="morning">בוקר</option>
                    <option value="afternoon">אחה״צ</option>
                    <option value="full-day">יום מלא</option>
                  </select>
                  <input
                    type="number"
                    value={editForm.total_price}
                    onChange={(e) => setEditForm({ ...editForm, total_price: e.target.value })}
                    placeholder="סכום"
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  />
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                  >
                    <option value="reserved">שריון זמני</option>
                    <option value="paid">שולם</option>
                    <option value="cancelled">בוטל</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#8c5e47] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#724a35] disabled:bg-stone-300 cursor-pointer"
                  >
                    {isSaving ? 'שומרת...' : 'שמירת שינויים'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancelBooking(editForm)}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 cursor-pointer"
                  >
                    ביטול הזמנה
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <p className="p-6 text-sm text-[#8c746c] bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl">טוענת הזמנות...</p>
            ) : viewMode === 'calendar' ? (
              <AdminBookingsCalendar
                bookings={filteredBookings}
                blockedSlots={blockedSlots}
                onSelectBooking={openEdit}
                onCancelBooking={handleCancelBooking}
              />
            ) : (
              <div className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl overflow-hidden">
                {filteredBookings.length === 0 ? (
                  <p className="p-6 text-sm text-[#8c746c]">אין הזמנות להצגה</p>
                ) : (
                  <ul className="divide-y divide-[#e8dfd3]">
                    {filteredBookings.map((booking) => (
                      <li key={booking.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="space-y-1 text-right">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#3b2a26]">{booking.full_name || 'ללא שם'}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                              booking.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : booking.status === 'cancelled'
                                  ? 'bg-stone-200 text-stone-600'
                                  : 'bg-amber-100 text-amber-800'
                            }`}>
                              {STATUS_LABELS[booking.status] || booking.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#8c746c]">
                            {booking.phone || 'ללא טלפון'}
                            {booking.profession ? ` · ${booking.profession}` : ''}
                          </p>
                          <p className="text-xs text-[#5c4a45]">
                            {booking.selected_date || 'ללא תאריך'}
                            {' · '}
                            {SHIFT_LABELS[booking.selected_shift] || booking.selected_shift || 'ללא משמרת'}
                            {' · '}
                            {booking.plan_id || 'ללא מסלול'}
                            {' · '}
                            {Number(booking.total_price || 0).toLocaleString()} ₪
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEdit(booking)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
                          >
                            שינוי
                          </button>
                          {booking.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(booking)}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              ביטול
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
