import { useMemo, useState } from 'react';
import { DAY_NAMES, SHIFT_LABELS } from '../clinicConfig';

const WEEKDAY_HEADERS = [...DAY_NAMES, 'יום שישי', 'יום שבת'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function statusClasses(status) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (status === 'cancelled') return 'bg-stone-100 text-stone-500 border-stone-200 line-through';
  return 'bg-amber-100 text-amber-900 border-amber-200';
}

export default function AdminBookingsCalendar({
  bookings,
  blockedSlots,
  onSelectBooking,
  onCancelBooking,
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);

  const monthLabel = cursor.toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  });

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay(); // 0 Sunday
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startWeekday);

    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      cells.push(date);
    }
    return cells;
  }, [cursor]);

  const bookingsByDate = useMemo(() => {
    const map = {};
    bookings.forEach((booking) => {
      const key = booking.selected_date;
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(booking);
    });
    Object.values(map).forEach((list) => {
      list.sort((a, b) => String(a.selected_shift).localeCompare(String(b.selected_shift)));
    });
    return map;
  }, [bookings]);

  const blocksForDate = (date) => {
    const key = toDateKey(date);
    const dayIndex = date.getDay();
    return (blockedSlots || []).filter((slot) => {
      if (slot.blocked_date) return slot.blocked_date === key;
      if (slot.day_index != null) return Number(slot.day_index) === dayIndex;
      return false;
    });
  };

  const goMonth = (delta) => {
    setSelectedDay(null);
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  const selectedKey = selectedDay;
  const selectedBookings = selectedKey ? (bookingsByDate[selectedKey] || []) : [];
  const selectedBlocks = selectedKey
    ? blocksForDate(new Date(`${selectedKey}T12:00:00`))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
          >
            ›
          </button>
          <h2 className="text-lg font-bold text-[#5c4a45] min-w-[9rem] text-center capitalize">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
          >
            ‹
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900">שריון</span>
          <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900">שולם</span>
          <span className="px-2 py-1 rounded-lg bg-[#f3e0d4] text-[#8c5e47] border border-dashed border-[#c4a08a]">חסום</span>
        </div>
      </div>

      <div className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#e8dfd3] bg-[#f3ebe1]">
          {WEEKDAY_HEADERS.map((name) => (
            <div key={name} className="px-1 py-2 text-center text-[10px] sm:text-xs font-bold text-[#8c746c]">
              {name.replace('יום ', '')}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = toDateKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const isWeekend = date.getDay() === 5 || date.getDay() === 6;
            const dayBookings = bookingsByDate[key] || [];
            const dayBlocks = blocksForDate(date);
            const isBlocked = dayBlocks.length > 0;
            const isSelected = selectedDay === key;
            const isToday = key === toDateKey(new Date());

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                className={`min-h-[7.5rem] sm:min-h-[9rem] p-1.5 text-right border border-[#e8dfd3] align-top transition-colors cursor-pointer ${
                  isSelected ? 'ring-2 ring-inset ring-[#8c5e47] bg-[#f5ebe0]' : 'bg-white hover:bg-[#fcfaf7]'
                } ${!inMonth ? 'opacity-40' : ''} ${isWeekend && inMonth ? 'bg-stone-50' : ''} ${
                  isBlocked ? 'bg-[linear-gradient(135deg,#faf6ef_25%,#f3e0d4_25%,#f3e0d4_50%,#faf6ef_50%,#faf6ef_75%,#f3e0d4_75%)] bg-[length:10px_10px]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${
                      isToday ? 'bg-[#8c5e47] text-white' : 'text-[#5c4a45]'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {isBlocked && (
                    <span className="text-[9px] font-bold text-[#8c5e47] bg-white/80 px-1 rounded border border-[#d9bda8]">
                      חסום
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <div
                      key={booking.id}
                      className={`rounded-md border px-1 py-0.5 text-[9px] sm:text-[10px] leading-tight ${statusClasses(booking.status)}`}
                    >
                      <p className="font-bold truncate">{booking.full_name || 'ללא שם'}</p>
                      <p className="truncate opacity-80">
                        {SHIFT_LABELS[booking.selected_shift] || booking.selected_shift}
                        {booking.phone ? ` · ${booking.phone}` : ''}
                      </p>
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <p className="text-[9px] text-[#8c746c] font-semibold">+{dayBookings.length - 3} נוספות</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-[#5c4a45]">
              פרטי {selectedDay}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-xs text-[#8c746c] hover:underline cursor-pointer"
            >
              סגירה
            </button>
          </div>

          {selectedBlocks.length > 0 && (
            <div className="rounded-xl border border-dashed border-[#c4a08a] bg-[#f3e0d4]/50 p-3 space-y-1">
              <p className="text-xs font-bold text-[#8c5e47]">משמרות חסומות ביום זה</p>
              {selectedBlocks.map((slot) => (
                <p key={slot.id} className="text-xs text-[#5c4a45]">
                  {SHIFT_LABELS[slot.shift] || slot.shift}
                  {slot.day_index != null ? ' · חוזר כל שבוע' : ' · חד־פעמי'}
                  {slot.note ? ` · ${slot.note}` : ''}
                </p>
              ))}
            </div>
          )}

          {selectedBookings.length === 0 ? (
            <p className="text-sm text-[#8c746c]">אין הזמנות ביום זה</p>
          ) : (
            <ul className="space-y-2">
              {selectedBookings.map((booking) => (
                <li
                  key={booking.id}
                  className="bg-white border border-[#e8dfd3] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="text-right space-y-0.5">
                    <p className="font-bold text-[#3b2a26]">{booking.full_name || 'ללא שם'}</p>
                    <p className="text-xs text-[#8c746c]">
                      {booking.phone || 'ללא טלפון'}
                      {booking.profession ? ` · ${booking.profession}` : ''}
                    </p>
                    <p className="text-xs text-[#5c4a45]">
                      {SHIFT_LABELS[booking.selected_shift] || booking.selected_shift}
                      {' · '}
                      {booking.plan_id || 'ללא מסלול'}
                      {' · '}
                      {Number(booking.total_price || 0).toLocaleString()} ₪
                      {' · '}
                      {booking.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectBooking(booking)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
                    >
                      שינוי
                    </button>
                    {booking.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => onCancelBooking(booking)}
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
    </div>
  );
}
