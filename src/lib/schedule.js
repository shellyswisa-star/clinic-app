/** משמרת שעתית: 6 שעות, מתחילה ב־08:00 */
export const HOURS_PER_SHIFT = 6;

export const MONTHLY_DURATION_OPTIONS = [
  { months: 1, label: 'חודש אחד' },
  { months: 3, label: '3 חודשים' },
  { months: 6, label: '6 חודשים' },
];

export const SHIFT_WINDOWS = {
  morning: {
    id: 'morning',
    label: '08:00 - 14:00 (בוקר)',
    short: '08:00–14:00',
  },
  afternoon: {
    id: 'afternoon',
    label: '14:00 - 20:00 (אחה״צ)',
    short: '14:00–20:00',
  },
  'full-day': {
    id: 'full-day',
    label: '08:00 - 20:00 (יום מלא)',
    short: '08:00–20:00',
  },
};

export const PARTIAL_SHIFTS = [SHIFT_WINDOWS.morning, SHIFT_WINDOWS.afternoon];

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 4 מופעים שבועיים מתאריך התחלה (למפגש שבועי) */
export function getSessionDates(startDateStr, count = 4) {
  if (!startDateStr) return [];
  const dates = [];
  const curr = parseIsoDate(startDateStr);
  for (let i = 0; i < count; i += 1) {
    dates.push(toIsoDate(curr));
    curr.setDate(curr.getDate() + 7);
  }
  return dates;
}

/**
 * תאריכים קונקרטיים להשכרה חודשית קבועה.
 * מ־startDateStr (כולל) ועד סוף טווח החודשים — כל הימים בשבוע שנבחרו (א׳–ה׳).
 */
export function getMonthlyConcreteDates(
  weekdayIndexes = [],
  { startDateStr, months = 1 } = {},
) {
  const uniqueDays = [...new Set(weekdayIndexes.map(Number))].filter((d) => d >= 0 && d <= 4);
  if (!uniqueDays.length || !startDateStr || months < 1) return [];

  const daySet = new Set(uniqueDays);
  const start = parseIsoDate(startDateStr);
  if (Number.isNaN(start.getTime())) return [];

  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(months));

  const result = [];
  const cursor = new Date(start);
  while (cursor < end) {
    if (daySet.has(cursor.getDay())) {
      result.push(toIsoDate(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function formatDateHe(iso) {
  if (!iso) return '';
  const d = parseIsoDate(iso);
  return d.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });
}

export function formatMonthRangeHe(startDateStr, months = 1) {
  if (!startDateStr) return '';
  const start = parseIsoDate(startDateStr);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(months));
  end.setDate(end.getDate() - 1);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString('he-IL', opts)} – ${end.toLocaleDateString('he-IL', opts)}`;
}
