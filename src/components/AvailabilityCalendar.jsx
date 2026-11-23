import { useMemo, useState } from 'react';
import { DAY_NAMES } from '../clinicConfig';
import { PARTIAL_SHIFTS, SHIFT_WINDOWS } from '../lib/schedule';

const WEEKDAY_HEADERS = [...DAY_NAMES, 'שישי', 'שבת'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseIso(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * יומן זמינות מלא — לכל יום חול מוצגות משמרות פנויות/תפוסות.
 * mode: 'partial' (בוקר/אחה״צ) | 'full-day'
 */
export default function AvailabilityCalendar({
  mode = 'partial',
  minDateStr,
  selectedDate = '',
  selectedShift = '',
  isShiftTaken,
  onSelect,
}) {
  const today = minDateStr || toDateKey(new Date());
  const [cursor, setCursor] = useState(() => startOfMonth(parseIso(today)));

  const monthLabel = cursor.toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  });

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay();
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

  const goMonth = (delta) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  const shifts =
    mode === 'full-day' ? [SHIFT_WINDOWS['full-day']] : PARTIAL_SHIFTS;

  return (
    <div className="space-y-4" data-testid="availability-calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
            aria-label="חודש קודם"
          >
            ›
          </button>
          <h3 className="text-base sm:text-lg font-bold text-[#5c4a45] min-w-[9rem] text-center capitalize">
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="px-3 py-2 rounded-xl text-sm font-bold bg-white border border-[#e8dfd3] hover:bg-[#f5ebe0] cursor-pointer"
            aria-label="חודש הבא"
          >
            ‹
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900">פנוי</span>
          <span className="px-2 py-1 rounded-lg bg-stone-200 text-stone-600">תפוס</span>
          <span className="px-2 py-1 rounded-lg bg-[#8c5e47] text-white">נבחר</span>
        </div>
      </div>

      <div className="bg-[#faf6ef] border border-[#e8dfd3] rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-[#e8dfd3] bg-[#f3ebe1]">
          {WEEKDAY_HEADERS.map((name) => (
            <div
              key={name}
              className="px-0.5 py-2 text-center text-[10px] sm:text-xs font-bold text-[#8c746c]"
            >
              {name.replace('יום ', '')}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((date) => {
            const key = toDateKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const dow = date.getDay();
            const isWeekend = dow === 5 || dow === 6;
            const isPast = key < today;
            const closed = isWeekend || isPast || !inMonth;
            const isSelectedDay = selectedDate === key;

            return (
              <div
                key={key}
                data-testid={inMonth && !isWeekend ? `cal-day-${key}` : undefined}
                className={`min-h-[5.5rem] sm:min-h-[6.5rem] border-t border-l border-[#eee4d8] p-1 sm:p-1.5 flex flex-col gap-1 ${
                  !inMonth ? 'bg-[#f3efe8]/50 text-[#b8a096]' : 'bg-[#fcfaf6]'
                } ${isSelectedDay ? 'ring-2 ring-inset ring-[#8c5e47]' : ''}`}
              >
                <div
                  className={`text-[11px] sm:text-xs font-bold px-0.5 ${
                    isSelectedDay ? 'text-[#8c5e47]' : 'text-[#5c4a45]'
                  }`}
                >
                  {date.getDate()}
                </div>

                {closed ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] text-[#b8a096]">
                      {isWeekend ? 'סגור' : isPast ? '—' : ''}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5 mt-auto">
                    {shifts.map((shift) => {
                      const taken = Boolean(isShiftTaken?.(key, shift.id));
                      const selected =
                        isSelectedDay && selectedShift === shift.id;
                      const shortLabel =
                        shift.id === 'morning'
                          ? 'בוקר'
                          : shift.id === 'afternoon'
                            ? 'אחה״צ'
                            : 'יום מלא';

                      return (
                        <button
                          key={shift.id}
                          type="button"
                          disabled={taken}
                          data-testid={`cal-shift-${shift.id}`}
                          title={
                            taken
                              ? `${shortLabel} תפוס`
                              : `${shortLabel} פנוי · ${shift.short}`
                          }
                          onClick={() => onSelect?.({ dateStr: key, shiftId: shift.id })}
                          className={`w-full rounded-md px-0.5 py-1 text-[9px] sm:text-[10px] font-bold leading-tight transition-colors ${
                            taken
                              ? 'bg-stone-200/80 text-stone-500 cursor-not-allowed line-through'
                              : selected
                                ? 'bg-[#8c5e47] text-white shadow-sm cursor-pointer'
                                : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 cursor-pointer'
                          }`}
                        >
                          {shortLabel}
                          <span className="hidden sm:inline">
                            {' · '}
                            {taken ? 'תפוס' : 'פנוי'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-[#8c746c] text-right">
        הקליניקה פתוחה בימים א׳–ה׳. לחצו על משמרת פנויה ביומן כדי לבחור אותה.
      </p>
    </div>
  );
}
