export const CLINIC_INFO = {
  name: 'שורשים',
  tagline: 'מרחב טיפולי שקט במושב אביאל',
  address: 'מושב אביאל, אלונה',
  hours: "א' - ה': 09:00 - 18:00",
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
    title: 'ססיה שבועית (משמרת קבועה)',
    badge: 'הכי מבוקש',
    desc: 'משמרת קבועה אחת לשבוע בכל שבוע לאורך החודש (4 משמרות בחודש).',
    unit: '/ חודש',
  },
  {
    id: 'hourly',
    title: 'השכרה שעתית גמישה',
    desc: 'הזמנת משמרת בודדת (4 שעות) לפי דרישה למועד מסוים.',
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
    desc: 'שריון 3-5 ימים קבועים בשבוע למשך חודש עד חצי שנה.',
    unit: '/ חודש',
  },
];

/** ברירת מחדל אם הטבלה בסופבייס עדיין לא קיימת / ריקה */
export const DEFAULT_PRICING = [
  { id: 'session', label: 'ססיה שבועית', amount: 800, sort_order: 1 },
  { id: 'hourly', label: 'מחיר לשעה (תצוגה)', amount: 60, sort_order: 2 },
  { id: 'hourly_shift', label: 'משמרת שעתית (4 שעות)', amount: 260, sort_order: 3 },
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
      return {
        ...meta,
        price: hourly,
        priceDisplay: `${hourly.toLocaleString()} ₪ ${meta.unit}`,
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

export function calcPlanTotal(planId, prices, { subPlanDays = 3 } = {}) {
  const p = pricingMap(prices);
  if (planId === 'monthly') return p[`monthly_${subPlanDays}`] || 0;
  if (planId === 'hourly') return p.hourly_shift || p.hourly || 0;
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
