import { isSlotBlocked } from '../clinicConfig';

export const HOLD_WINDOW_MS = 10 * 60 * 1000;

export function shiftsOverlap(a, b) {
  if (!a || !b) return false;
  return a === b || a === 'full-day' || b === 'full-day';
}

/** האם הזמנה קיימת עדיין חוסמת משמרת (שולם / סדרה / שריון טרי) */
export function bookingHoldsSlot(booking, now = new Date()) {
  if (!booking) return false;
  if (booking.status === 'cancelled') return false;
  if (booking.status === 'paid') return true;
  if (booking.status !== 'reserved') return false;
  // סדרה שבועית/חודשית תופסת את כל המועדים עד ביטול — לא רק 10 דקות
  if (booking.series_id) return true;
  if (booking.plan_id === 'session' || booking.plan_id === 'monthly') return true;
  if (!booking.created_at) return false;
  return now.getTime() - new Date(booking.created_at).getTime() < HOLD_WINDOW_MS;
}

/**
 * מניעת דאבל-בוקינג: אותה משמרת/יום מלא תפוסה
 * אם כבר שמורה ע״י הזמנה פעילה או חסימה ידנית.
 */
export function isShiftTaken({
  dateStr,
  shiftStr,
  existingBookings = [],
  blockedSlots = [],
  now = new Date(),
}) {
  if (!dateStr || !shiftStr) return false;

  const wantDate = String(dateStr).slice(0, 10);
  const takenByBooking = existingBookings.some((booking) => {
    if (String(booking.selected_date || '').slice(0, 10) !== wantDate) return false;
    if (!shiftsOverlap(booking.selected_shift, shiftStr)) return false;
    return bookingHoldsSlot(booking, now);
  });

  if (takenByBooking) return true;

  const dateObj = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = Number.isNaN(dateObj.getTime()) ? null : dateObj.getDay();

  return isSlotBlocked(blockedSlots, {
    dateStr,
    dayIndex: dayOfWeek,
    shift: shiftStr,
  });
}

/** זיהוי כפילות הזמנות פעילות על אותה משבצת (רגרסיה / ביקורת נתונים) */
export function findDuplicateActiveBookings(bookings = [], now = new Date()) {
  const active = bookings.filter((b) => bookingHoldsSlot(b, now) && b.selected_date && b.selected_shift);
  const groups = new Map();

  active.forEach((booking) => {
    const key = `${booking.selected_date}::${booking.selected_shift}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(booking);
  });

  const duplicates = [];
  for (const [key, list] of groups.entries()) {
    // יום מלא מתנגש גם עם בוקר/אחה״צ — בדיקה צולבת
    if (list.length > 1) {
      duplicates.push({ key, bookings: list });
    }
  }

  // התנגשויות בין full-day למשמרת חלקית
  const byDate = new Map();
  active.forEach((b) => {
    if (!byDate.has(b.selected_date)) byDate.set(b.selected_date, []);
    byDate.get(b.selected_date).push(b);
  });

  for (const [date, list] of byDate.entries()) {
    const fullDays = list.filter((b) => b.selected_shift === 'full-day');
    const partials = list.filter((b) => b.selected_shift !== 'full-day');
    if (fullDays.length && partials.length) {
      duplicates.push({
        key: `${date}::full-day-overlap`,
        bookings: [...fullDays, ...partials],
      });
    }
  }

  return duplicates;
}

export function validateBookingForm({ name = '', phone = '' }) {
  const errors = {};
  if (!name.trim()) {
    errors.name = 'נא להזין שם מלא';
  } else if (name.trim().length < 2) {
    errors.name = 'השם חייב להכיל לפחות 2 תווים';
  }

  const phoneClean = phone.replace(/[- ]/g, '');
  const phoneRegex = /^0[2-9]\d{7,8}$/;
  if (!phoneClean) {
    errors.phone = 'נא להזין מספר טלפון';
  } else if (!phoneRegex.test(phoneClean)) {
    errors.phone = 'מספר טלפון אינו תקין (לדוגמה: 0501234567)';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

const ADMIN_STATUSES = new Set(['reserved', 'paid', 'cancelled']);
const ADMIN_SHIFTS = new Set(['morning', 'afternoon', 'full-day']);

/** ולידציה לטופס עריכת הזמנה בלוח הניהול */
export function validateAdminBookingEdit(form = {}) {
  const base = validateBookingForm({
    name: form.full_name || '',
    phone: form.phone || '',
  });
  const errors = { ...base.errors };

  if (!form.selected_date && form.status !== 'cancelled') {
    errors.selected_date = 'נא לבחור תאריך';
  }

  if (!ADMIN_SHIFTS.has(form.selected_shift)) {
    errors.selected_shift = 'משמרת לא תקינה';
  }

  if (!ADMIN_STATUSES.has(form.status)) {
    errors.status = 'מצב לא תקין';
  }

  const price = Number(form.total_price);
  if (form.total_price === '' || form.total_price === null || form.total_price === undefined) {
    errors.total_price = 'נא להזין סכום';
  } else if (Number.isNaN(price) || price < 0) {
    errors.total_price = 'סכום חייב להיות מספר שאינו שלילי';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    message: Object.values(errors)[0] || '',
  };
}

/** מונע חיוב/שמירה כפולה בזמן בקשה פתוחה */
export function canStartSave({ isSaving }) {
  return !isSaving;
}
