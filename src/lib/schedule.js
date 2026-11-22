/** משמרת שעתית: 6 שעות, מתחילה ב־08:00 */
export const HOURS_PER_SHIFT = 6;

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

/** 4 מופעים שבועיים מתאריך התחלה (לססיה) */
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
 * תאריכים קונקרטיים לחודש קבוע:
 * לכל יום בשבוע שנבחר — 4 מופעים קדימה (סה״כ weekdays.length * weeks).
 */
export function getMonthlyConcreteDates(weekdayIndexes = [], { weeks = 4, fromDate = new Date() } = {}) {
  const uniqueDays = [...new Set(weekdayIndexes.map(Number))].filter((d) => d >= 0 && d <= 4);
  if (!uniqueDays.length) return [];

  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const result = [];

  uniqueDays.forEach((weekday) => {
    const cursor = new Date(start);
    // התחילי ממחר כדי לא לשריין היום בלי כוונה
    cursor.setDate(cursor.getDate() + 1);
    while (cursor.getDay() !== weekday) {
      cursor.setDate(cursor.getDate() + 1);
    }
    for (let w = 0; w < weeks; w += 1) {
      result.push(toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
  });

  return result.sort();
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
