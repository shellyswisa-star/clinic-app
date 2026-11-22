import { DAY_NAMES, SHIFT_LABELS } from '../clinicConfig';
import { formatDateHe, formatMonthRangeHe } from './schedule';

export const PLAN_LABELS = {
  session: 'מפגש שבועי',
  hourly: 'השכרה שעתית',
  daily: 'השכרה יומית',
  monthly: 'השכרה חודשית קבועה',
};

export function newSeriesId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `series-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** תווית אנושית לסדרה — מוצגת באדמין */
export function buildSeriesLabel({
  planId,
  weekdays = [],
  shift,
  startDateStr,
  months,
  dates = [],
}) {
  const plan = PLAN_LABELS[planId] || planId;
  const days =
    weekdays.length > 0
      ? weekdays.map((d) => DAY_NAMES[d] || d).join(', ')
      : [...new Set(dates.map((iso) => DAY_NAMES[new Date(`${iso}T12:00:00`).getDay()]))].join(', ');
  const shiftLabel = SHIFT_LABELS[shift] || shift || '';
  const range =
    startDateStr && months
      ? formatMonthRangeHe(startDateStr, months)
      : dates.length
        ? `${formatDateHe(dates[0])} – ${formatDateHe(dates[dates.length - 1])}`
        : '';
  const count = dates.length ? ` · ${dates.length} מועדים` : '';
  const duration = months ? ` · ${months === 1 ? 'חודש אחד' : `${months} חודשים`}` : '';
  return [plan, days, shiftLabel, range].filter(Boolean).join(' · ') + duration + count;
}

/**
 * בני משפחה של סדרה:
 * 1) series_id זהה
 * 2) נפילה לאחור: אותו טלפון+מסלול+משמרת, נוצרו בחלון של 3 דקות
 */
export function findSeriesMembers(booking, allBookings = []) {
  if (!booking) return [];

  // תמיד מעדיפים את הרשומה המלאה מהרשימה (created_at וכו')
  const seed =
    (booking.id != null && allBookings.find((b) => b.id === booking.id)) || booking;

  if (seed.series_id) {
    return allBookings
      .filter((b) => b.series_id === seed.series_id)
      .sort((a, b) => String(a.selected_date).localeCompare(String(b.selected_date)));
  }

  if (!seed.phone || !seed.plan_id || !seed.created_at) return seed.id != null ? [seed] : [booking];
  if (seed.plan_id !== 'session' && seed.plan_id !== 'monthly') return [seed];

  const created = new Date(seed.created_at).getTime();
  const windowMs = 3 * 60 * 1000;

  return allBookings
    .filter((b) => {
      if (b.phone !== seed.phone) return false;
      if (b.plan_id !== seed.plan_id) return false;
      if (b.selected_shift !== seed.selected_shift) return false;
      if (!b.created_at) return false;
      return Math.abs(new Date(b.created_at).getTime() - created) <= windowMs;
    })
    .sort((a, b) => String(a.selected_date).localeCompare(String(b.selected_date)));
}

export function summarizeSeries(members = []) {
  if (!members.length) return null;
  const first = members[0];
  const dates = members.map((m) => m.selected_date).filter(Boolean);
  const active = members.filter((m) => m.status !== 'cancelled');
  const priced = members.reduce((sum, m) => sum + (Number(m.total_price) || 0), 0);
  return {
    label: first.series_label || buildSeriesLabel({
      planId: first.plan_id,
      shift: first.selected_shift,
      dates,
    }),
    planLabel: PLAN_LABELS[first.plan_id] || first.plan_id,
    shiftLabel: SHIFT_LABELS[first.selected_shift] || first.selected_shift,
    dates,
    total: members.length,
    activeCount: active.length,
    start: dates[0] || null,
    end: dates[dates.length - 1] || null,
    totalPrice: priced,
  };
}

/**
 * קיבוץ להצגה ברשימת אדמין: סדרה = שורה אחת (במקום 78 כרטיסים).
 * מקבצים רק בתוך הרשימה המסוננת — סינון לפי תאריך בודד יישאר מופעים בודדים.
 */
export function groupBookingsForList(filteredBookings = []) {
  const seen = new Set();
  const rows = [];

  for (const booking of filteredBookings) {
    if (seen.has(booking.id)) continue;

    const members = findSeriesMembers(booking, filteredBookings);
    const group = members.length > 1 ? members : [booking];
    group.forEach((m) => seen.add(m.id));

    const primary =
      group.find((m) => Number(m.total_price) > 0) ||
      group.find((m) => m.status === 'paid') ||
      group[0];

    rows.push({
      key: primary.series_id || `single-${primary.id}`,
      isSeries: group.length > 1,
      members: group,
      primary,
      summary: summarizeSeries(group),
    });
  }

  return rows;
}
