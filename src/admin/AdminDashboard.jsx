import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { SHIFT_LABELS } from '../clinicConfig';
import { mapAdminError, mapBookingError } from '../lib/bookingApi';
import { isShiftTaken, validateAdminBookingEdit } from '../lib/bookingRules';
import {
  PLAN_LABELS,
  findSeriesMembers,
  groupBookingsForList,
  summarizeSeries,
} from '../lib/bookingSeries';
import { formatDateHe } from '../lib/schedule';
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
  series_id: null,
  series_label: '',
  created_at: null,
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
  const [expandedSeries, setExpandedSeries] = useState(() => new Set());

  const fetchBookings = async ({ clearError = false } = {}) => {
    setLoading(true);
    // לא מוחקים שגיאת שמירה קיימת בזמן רענון אחרי פעולה — אחרת 400 «נעלם» והצלחה נשארת
    if (clearError) setError('');
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
    if (tab === 'bookings') fetchBookings({ clearError: true });
  }, [tab]);

  const assertOccurrenceSlotFree = (memberId, nextDate, nextShift) => {
    if (!nextDate || !nextShift) return { ok: true };
    const taken = isShiftTaken({
      dateStr: String(nextDate).slice(0, 10),
      shiftStr: nextShift,
      existingBookings: bookings.filter((b) => String(b.id) !== String(memberId)),
      blockedSlots: [], // חסימות — מנהלת יכולה לעקוף; התנגשות בין הזמנות — לא
    });
    if (!taken) return { ok: true };
    return {
      ok: false,
      message:
        'לא ניתן לעדכן: התאריך והמשמרת האלה כבר תפוסים בהזמנה אחרת (כולל מועד אחר באותה סדרה). בחרו יום אחר.',
    };
  };

  const latestCreated = useMemo(() => bookings[0] || null, [bookings]);
  const latestSeries = useMemo(() => {
    if (!latestCreated) return null;
    return summarizeSeries(findSeriesMembers(latestCreated, bookings));
  }, [latestCreated, bookings]);

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

  const listRows = useMemo(
    () => groupBookingsForList(filteredBookings),
    [filteredBookings],
  );

  const toggleSeriesExpanded = (key) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      series_id: booking.series_id || null,
      series_label: booking.series_label || '',
      created_at: booking.created_at || null,
    });
    // אחרי בחירה מהיומן — גלגלי למעלה לטופס העריכה
    setTimeout(() => {
      document.getElementById('admin-edit-booking')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  };

  const seriesMembers = useMemo(() => {
    if (!editForm.id) return [];
    const current = bookings.find((b) => b.id === editForm.id) || editForm;
    return findSeriesMembers(current, bookings);
  }, [editForm, bookings]);

  const seriesInfo = useMemo(() => summarizeSeries(seriesMembers), [seriesMembers]);

  const closeEdit = () => {
    setEditForm(emptyEdit);
  };

  const showError = (message) => {
    setNotice('');
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
    if (!editForm.id || isSaving) return;
    setIsSaving(true);
    setNotice('');
    setError('');

    const validation = validateAdminBookingEdit(editForm);
    if (!validation.ok) {
      showError(validation.message);
      setIsSaving(false);
      return;
    }

    const original = bookings.find((b) => String(b.id) === String(editForm.id));
    const nextDate = editForm.selected_date || null;
    const nextShift = editForm.selected_shift;
    const dateChanged = !original || original.selected_date !== nextDate;
    const shiftChanged = !original || original.selected_shift !== nextShift;

    if (dateChanged || shiftChanged) {
      const slotCheck = assertOccurrenceSlotFree(editForm.id, nextDate, nextShift);
      if (!slotCheck.ok) {
        showError(slotCheck.message);
        setIsSaving(false);
        return;
      }
    }

    try {
      const contact = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        profession: editForm.profession.trim(),
      };
      const members = findSeriesMembers(editForm, bookings);

      // סנכרון פרטי לקוחה לשאר הסדרה — בלי לגעת בתאריכים שלהם
      if (members.length > 1) {
        const otherIds = members
          .map((m) => m.id)
          .filter((id) => String(id) !== String(editForm.id));
        if (otherIds.length) {
          const { error: syncError } = await supabase
            .from('bookings')
            .update(contact)
            .in('id', otherIds);
          if (syncError) throw syncError;
        }
      }

      // תמיד שולחים תאריך+משמרת למועד הנוכחי, ואז מוודאים מה חזר מהשרת
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({
          ...contact,
          selected_date: nextDate,
          selected_shift: nextShift,
          total_price: Number(editForm.total_price) || 0,
          status: editForm.status,
          plan_id: editForm.plan_id,
        })
        .eq('id', editForm.id)
        .select('id, selected_date, selected_shift')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated?.id) {
        throw new Error('העדכון לא נשמר. רעננו את הרשימה ונסו שוב.');
      }
      if (dateChanged && updated.selected_date !== nextDate) {
        throw new Error(
          'התאריך לא נשמר — ייתכן שהמועד כבר תפוס בהזמנה אחרת. התאריך נשאר כמו שהיה.',
        );
      }

      setError('');
      if (dateChanged || shiftChanged) {
        setNotice(
          members.length > 1
            ? 'המועד עודכן · פרטי הלקוחה עודכנו בכל הסדרה'
            : 'ההזמנה עודכנה',
        );
      } else {
        setNotice(
          members.length > 1 ? 'פרטי הלקוחה עודכנו בכל הסדרה' : 'ההזמנה עודכנה',
        );
      }
      closeEdit();
      await fetchBookings();
    } catch (err) {
      showError(mapBookingError(err) || 'עדכון ההזמנה נכשל');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelBooking = async (booking, { wholeSeries = false } = {}) => {
    const members = wholeSeries ? findSeriesMembers(booking, bookings) : [booking];
    const msg = wholeSeries
      ? `לבטל את כל ${members.length} המועדים בסדרה של ${booking.full_name || 'הלקוחה'}?`
      : `לבטל את המועד ${booking.selected_date || ''} של ${booking.full_name || 'הלקוחה'}?`;
    if (!window.confirm(msg)) return;
    setError('');
    setNotice('');

    try {
      const ids = members.map((m) => m.id);
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .in('id', ids);

      if (updateError) throw updateError;
      setNotice(wholeSeries ? 'כל מועדי הסדרה בוטלו' : 'המועד בוטל');
      if (ids.includes(editForm.id)) closeEdit();
      await fetchBookings();
    } catch (err) {
      showError(mapBookingError(err) || 'ביטול ההזמנה נכשל');
    }
  };

  const handleSaveOccurrenceDate = async (memberId, nextDate) => {
    if (!nextDate || isSaving) return;
    const member = bookings.find((b) => String(b.id) === String(memberId));
    const normalized = String(nextDate).slice(0, 10);
    if (!member || member.selected_date === normalized) return;

    setIsSaving(true);
    setNotice('');
    setError('');

    const slotCheck = assertOccurrenceSlotFree(
      memberId,
      normalized,
      member.selected_shift || editForm.selected_shift,
    );
    if (!slotCheck.ok) {
      showError(slotCheck.message);
      // מחזירים את ה־input לערך מהשרת (controlled דרך member.selected_date)
      setBookings((prev) => [...prev]);
      setIsSaving(false);
      return;
    }

    try {
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ selected_date: normalized })
        .eq('id', memberId)
        .select('id, selected_date')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated?.id) {
        throw new Error('התאריך לא עודכן. רעננו ונסו שוב.');
      }
      if (updated.selected_date !== normalized) {
        throw new Error(
          'התאריך לא נשמר — המועד כנראה כבר תפוס. התאריך נשאר כמו שהיה.',
        );
      }
      if (String(editForm.id) === String(memberId)) {
        setEditForm((prev) => ({ ...prev, selected_date: normalized }));
      }
      setError('');
      setNotice('תאריך המועד עודכן');
      await fetchBookings();
    } catch (err) {
      showError(mapBookingError(err) || 'עדכון התאריך נכשל');
      await fetchBookings();
    } finally {
      setIsSaving(false);
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
            <h1 className="text-2xl font-bold title-handwritten tracking-wide text-[#5c4a45]">לוח ניהול</h1>
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

        {notice && !error && <AlertBanner tone="success">{notice}</AlertBanner>}
        {/* שגיאה תמיד למעלה — כדי שלא תיעלם אחרי רענון/סגירת טופס */}
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
                    {latestSeries && latestSeries.total > 1 ? (
                      <>
                        סדרה: {formatDateHe(latestSeries.start)} – {formatDateHe(latestSeries.end)}
                        {' · '}
                        {latestSeries.activeCount}/{latestSeries.total} מועדים
                        {' · '}
                        {latestSeries.shiftLabel}
                      </>
                    ) : (
                      <>מועד: {formatDateHe(latestCreated.selected_date) || latestCreated.selected_date || '—'}</>
                    )}
                    {latestCreated.created_at
                      ? ` · נקלטה: ${new Date(latestCreated.created_at).toLocaleString('he-IL')}`
                      : ''}
                  </p>
                  {latestSeries?.label && latestSeries.total > 1 && (
                    <p className="text-[11px] text-[#8c5e47]">{latestSeries.label}</p>
                  )}
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
                  <option value="all">כל המצבים</option>
                  <option value="reserved">שריון זמני</option>
                  <option value="paid">שולם</option>
                  <option value="cancelled">בוטל</option>
                </select>
                <button
                  type="button"
                  onClick={() => fetchBookings({ clearError: true })}
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

                {seriesInfo && seriesMembers.length > 1 && (
                  <div
                    data-testid="admin-series-panel"
                    className="bg-white border border-[#e8dfd3] rounded-xl p-3 space-y-2"
                  >
                    <div className="text-right space-y-1">
                      <p className="text-[11px] font-bold text-[#8c5e47]">סדרת מועדים</p>
                      <p className="text-sm font-bold text-[#3b2a26]">
                        {PLAN_LABELS[editForm.plan_id] || editForm.plan_id}
                      </p>
                      <p className="text-xs text-[#5c4a45] leading-relaxed">
                        {seriesInfo.label}
                      </p>
                      <p className="text-[11px] text-[#8c746c]">
                        התחלה {formatDateHe(seriesInfo.start)} · סיום {formatDateHe(seriesInfo.end)}
                        {' · '}
                        {seriesInfo.activeCount}/{seriesInfo.total} פעילים
                        {' · '}
                        משמרת {seriesInfo.shiftLabel}
                      </p>
                    </div>

                    <ul className="max-h-52 overflow-y-auto divide-y divide-[#eee4d8] border border-[#eee4d8] rounded-lg">
                      {seriesMembers.map((member) => {
                        const isCurrent = member.id === editForm.id;
                        return (
                          <li
                            key={member.id}
                            className={`p-2.5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between text-xs ${
                              isCurrent ? 'bg-[#f5ebe0]' : 'bg-white'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-right">
                              <span className="font-bold text-[#3b2a26]">
                                {formatDateHe(member.selected_date) || member.selected_date}
                              </span>
                              <span className="text-[#8c746c]">
                                {SHIFT_LABELS[member.selected_shift] || member.selected_shift}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-full font-semibold ${
                                  member.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : member.status === 'cancelled'
                                      ? 'bg-stone-200 text-stone-600'
                                      : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {STATUS_LABELS[member.status] || member.status}
                              </span>
                              {Number(member.total_price) > 0 && (
                                <span className="text-[#8c5e47] font-semibold">
                                  {Number(member.total_price).toLocaleString()} ₪
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <input
                                type="date"
                                value={member.selected_date || ''}
                                disabled={isSaving || member.status === 'cancelled'}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (next && next !== member.selected_date) {
                                    handleSaveOccurrenceDate(member.id, next);
                                  }
                                }}
                                className="p-1.5 border border-[#cbd5e1] rounded-lg text-[11px] bg-[#faf8f5] disabled:opacity-50"
                                title="שינוי תאריך למועד זה"
                              />
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(member)}
                                  className="px-2 py-1 rounded-lg border border-[#e8dfd3] font-bold hover:bg-[#f5ebe0] cursor-pointer"
                                >
                                  פתיחה
                                </button>
                              )}
                              {member.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(member)}
                                  className="px-2 py-1 rounded-lg border border-red-200 text-red-700 font-bold hover:bg-red-50 cursor-pointer"
                                >
                                  ביטול מועד
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">שם מלא</span>
                    <input
                      required
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                    />
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">טלפון</span>
                    <input
                      required
                      inputMode="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="0501234567"
                      className={`w-full p-3 border rounded-xl text-sm bg-white ${
                        error?.includes('טלפון') ? 'border-red-400 bg-red-50/40' : 'border-[#cbd5e1]'
                      }`}
                    />
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">תחום טיפול</span>
                    <input
                      value={editForm.profession}
                      onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                    />
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">מסלול</span>
                    <input
                      value={PLAN_LABELS[editForm.plan_id] || editForm.plan_id}
                      readOnly
                      title={editForm.plan_id}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-[#f5f1ea] text-[#5c4a45]"
                    />
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">תאריך המועד</span>
                    <input
                      type="date"
                      value={editForm.selected_date}
                      onChange={(e) => setEditForm({ ...editForm, selected_date: e.target.value })}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                    />
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">משמרת</span>
                    <select
                      value={editForm.selected_shift}
                      onChange={(e) => setEditForm({ ...editForm, selected_shift: e.target.value })}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                    >
                      <option value="morning">בוקר</option>
                      <option value="afternoon">אחה״צ</option>
                      <option value="full-day">יום מלא</option>
                    </select>
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">סכום (₪)</span>
                    <input
                      type="number"
                      value={editForm.total_price}
                      onChange={(e) => setEditForm({ ...editForm, total_price: e.target.value })}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                    />
                  </label>
                  <label className="block text-right space-y-1">
                    <span className="text-[11px] font-bold text-[#8c746c]">סטטוס</span>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full p-3 border border-[#cbd5e1] rounded-xl text-sm bg-white"
                    >
                      <option value="reserved">שריון זמני</option>
                      <option value="paid">שולם</option>
                      <option value="cancelled">בוטל</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
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
                    ביטול מועד זה
                  </button>
                  {seriesMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleCancelBooking(editForm, { wholeSeries: true })}
                      className="bg-white border border-red-300 text-red-800 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 cursor-pointer"
                    >
                      ביטול כל הסדרה
                    </button>
                  )}
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
                {listRows.length === 0 ? (
                  <p className="p-6 text-sm text-[#8c746c]">אין הזמנות להצגה</p>
                ) : (
                  <ul className="divide-y divide-[#e8dfd3]">
                    {listRows.map((row) => {
                      const booking = row.primary;
                      const summary = row.summary;
                      const expanded = expandedSeries.has(row.key);

                      return (
                        <li key={row.key} className="p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
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
                                {row.isSeries && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#f5ebe0] text-[#8c5e47]">
                                    סדרה · {summary.activeCount}/{summary.total} מועדים
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#8c746c]">
                                {booking.phone || 'ללא טלפון'}
                                {booking.profession ? ` · ${booking.profession}` : ''}
                              </p>
                              {row.isSeries ? (
                                <>
                                  <p className="text-xs text-[#5c4a45]">
                                    {formatDateHe(summary.start)} – {formatDateHe(summary.end)}
                                    {' · '}
                                    {summary.shiftLabel}
                                    {' · '}
                                    {summary.planLabel}
                                    {' · '}
                                    {Number(summary.totalPrice || 0).toLocaleString()} ₪
                                  </p>
                                  {summary.label && (
                                    <p className="text-[11px] text-[#8c5e47]">{summary.label}</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-[#5c4a45]">
                                  {formatDateHe(booking.selected_date) || booking.selected_date || 'ללא תאריך'}
                                  {' · '}
                                  {SHIFT_LABELS[booking.selected_shift] || booking.selected_shift || 'ללא משמרת'}
                                  {' · '}
                                  {PLAN_LABELS[booking.plan_id] || booking.plan_id || 'ללא מסלול'}
                                  {' · '}
                                  {Number(booking.total_price || 0).toLocaleString()} ₪
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 shrink-0">
                              {row.isSeries && (
                                <button
                                  type="button"
                                  onClick={() => toggleSeriesExpanded(row.key)}
                                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
                                >
                                  {expanded ? 'הסתרת מועדים' : 'כל המועדים'}
                                </button>
                              )}
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
                                  onClick={() =>
                                    handleCancelBooking(booking, { wholeSeries: row.isSeries })
                                  }
                                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                                >
                                  {row.isSeries ? 'ביטול סדרה' : 'ביטול'}
                                </button>
                              )}
                            </div>
                          </div>

                          {row.isSeries && expanded && (
                            <ul className="border border-[#eee4d8] rounded-xl divide-y divide-[#eee4d8] bg-white max-h-64 overflow-y-auto">
                              {row.members.map((member) => (
                                <li
                                  key={member.id}
                                  className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                                >
                                  <span className="text-right">
                                    <span className="font-bold text-[#3b2a26]">
                                      {formatDateHe(member.selected_date) || member.selected_date}
                                    </span>
                                    {' · '}
                                    {SHIFT_LABELS[member.selected_shift] || member.selected_shift}
                                    {' · '}
                                    {STATUS_LABELS[member.status] || member.status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(member)}
                                    className="px-2 py-1 rounded-lg border border-[#e8dfd3] font-bold hover:bg-[#f5ebe0] cursor-pointer"
                                  >
                                    עריכת מועד
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
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
