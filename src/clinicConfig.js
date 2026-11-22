import { HOURS_PER_SHIFT } from './lib/schedule';

export const CLINIC_INFO = {
  name: 'שורשים',
  tagline: 'מרחב טיפולי שקט במושב אביאל',
  address: 'מושב אביאל, אלונה',
  hours: "א' - ה': 08:00 - 20:00",
  imageUrl: '/clinic-space.jpg',
};

export const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי'];

export const SHIFT_LABELS = {
  morning: 'בוקר',
  afternoon: 'אחה״צ',
  'full-day': 'יום מלא',
};

/** מטא־דאטה של מסלולים (כותרות/תיאורים). המחירים מגיעים מטבלת pricing */
export const PLAN_META = [
  {
    id: 'session',
    title: 'מפגש שבועי (משמרת קבועה)',
    badge: 'הכי מבוקש',
    desc: 'משמרת קבועה אחת לשבוע בכל שבוע לאורך החודש (4 משמרות בחודש).',
    unit: '/ חודש',
  },
  {
    id: 'hourly',
    title: 'השכרה שעתית גמישה',
    desc: `משמרת בודדת של ${HOURS_PER_SHIFT} שעות (מ־08:00) למועד מסוים.`,
    unit: '/ שעה',
  },
  {
    id: 'daily',
    title: 'השכרה יומית חד-פעמית',
    desc: 'יום עבודה מלא ופרטי (08:00 - 20:00) בתאריך בודד.',
    unit: '/ יום',
  },
  {
    id: 'monthly',
    title: 'השכרה חודשית קבועה',
    desc: 'שריון 3–5 ימים קבועים בשבוע — בוחרים מתי מתחילים ולכמה חודשים, עם תאריכים מהיומן.',
    unit: '/ חודש',
  },
];

/** ברירת מחדל אם הטבלה בסופבייס עדיין לא קיימת / ריקה */
export const DEFAULT_PRICING = [
  { id: 'session', label: 'מפגש שבועי', amount: 800, sort_order: 1 },
  { id: 'hourly', label: 'מחיר לשעה', amount: 60, sort_order: 2 },
  // נשמר לתאימות לאדמין ישן; החיוב בפועל = hourly × HOURS_PER_SHIFT
  { id: 'hourly_shift', label: `משמרת שעתית (${HOURS_PER_SHIFT} שעות)`, amount: 60 * HOURS_PER_SHIFT, sort_order: 3 },
  { id: 'daily', label: 'יום מלא', amount: 500, sort_order: 4 },
  { id: 'monthly_3', label: 'חודשי — 3 ימים', amount: 2200, sort_order: 5 },
  { id: 'monthly_4', label: 'חודשי — 4 ימים', amount: 2800, sort_order: 6 },
  { id: 'monthly_5', label: 'חודשי — 5 ימים', amount: 3500, sort_order: 7 },
];

export function pricingMap(rows) {
  const map = {};
  (rows?.length ? rows : DEFAULT_PRICING).forEach((row) => {
    map[row.id] = Number(row.amount) || 0;
  });
  return map;
}

export function hourlyShiftTotal(prices) {
  const p = pricingMap(prices);
  const rate = p.hourly ?? 60;
  return rate * HOURS_PER_SHIFT;
}

export function buildPlans(prices) {
  const p = pricingMap(prices);
  return PLAN_META.map((meta) => {
    if (meta.id === 'monthly') {
      const from = p.monthly_3 || DEFAULT_PRICING.find((x) => x.id === 'monthly_3').amount;
      return {
        ...meta,
        price: from,
        priceDisplay: `החל מ-${from.toLocaleString()} ₪ ${meta.unit}`,
      };
    }
    if (meta.id === 'hourly') {
      const hourly = p.hourly ?? 60;
      const shiftTotal = hourly * HOURS_PER_SHIFT;
      return {
        ...meta,
        price: hourly,
        priceDisplay: `${hourly.toLocaleString()} ₪ ${meta.unit}`,
        priceHint: `משמרת ${HOURS_PER_SHIFT} ש׳ = ${shiftTotal.toLocaleString()} ₪`,
      };
    }
    const amount = p[meta.id] ?? 0;
    return {
      ...meta,
      price: amount,
      priceDisplay: `${amount.toLocaleString()} ₪ ${meta.unit}`,
    };
  });
}

export function calcPlanTotal(planId, prices, { subPlanDays = 3, months = 1 } = {}) {
  const p = pricingMap(prices);
  if (planId === 'monthly') {
    const monthly = p[`monthly_${subPlanDays}`] || 0;
    return monthly * Math.max(1, Number(months) || 1);
  }
  // שעתי: תמיד rate × שעות משמרת — לא ערך hourly_shift הישן (260)
  if (planId === 'hourly') return hourlyShiftTotal(prices);
  return p[planId] || 0;
}

/** האם משבצת חסומה לפי תאריך/יום + משמרת */
export function isSlotBlocked(blockedSlots, { dateStr, dayIndex, shift }) {
  if (!blockedSlots?.length) return false;

  return blockedSlots.some((slot) => {
    const shiftMatch =
      slot.shift === shift ||
      slot.shift === 'full-day' ||
      shift === 'full-day';

    if (!shiftMatch) return false;

    if (slot.blocked_date) {
      return Boolean(dateStr) && slot.blocked_date === dateStr;
    }

    if (slot.day_index != null && dayIndex != null) {
      return Number(slot.day_index) === Number(dayIndex);
    }

    return false;
  });
}
