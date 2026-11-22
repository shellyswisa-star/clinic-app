import { supabase } from '../supabaseClient';

export const SLOT_ALREADY_BOOKED = 'slot_already_booked';
export const SLOT_BLOCKED = 'slot_blocked';

function errorBlob(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return [
    error.message,
    error.details,
    error.hint,
    error.code,
    error.status,
    error.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** מיפוי שגיאות הזמנה / עדכון משבצת להודעות בעברית */
export function mapBookingError(error) {
  const raw = errorBlob(error);

  if (raw.includes(SLOT_ALREADY_BOOKED) || raw.includes('already booked')) {
    return 'המשמרת כבר נתפסה. נסי תאריך או משמרת אחרת.';
  }
  if (raw.includes(SLOT_BLOCKED)) {
    return 'המשמרת חסומה במערכת. נסי מועד אחר.';
  }
  if (raw.includes('invalid_shift')) {
    return 'משמרת לא תקינה.';
  }
  if (/unauthorized_invalid_api_key|invalid.?api.?key|no api key/.test(raw)) {
    return 'מפתח API לא תקין. בדקי את הגדרות הסביבה וריסטארט לשרת הפיתוח.';
  }
  if (/jwt expired|session.?expired|not authenticated|invalid.?jwt/.test(raw)) {
    return 'פג תוקף ההתחברות. התחברי מחדש.';
  }
  if (/row-level security|rls|permission denied|42501|401|403/.test(raw)) {
    return 'אין הרשאה לבצע את הפעולה הזו.';
  }
  if (/failed to fetch|networkerror|network request failed|timeout|econnrefused/.test(raw)) {
    return 'בעיית רשת. בדקי את החיבור ונסי שוב.';
  }
  if (/check constraint|23514|22p02|invalid input syntax/.test(raw)) {
    return 'הנתונים שנשלחו לא תקינים. בדקי תאריך, משמרת וסכום.';
  }
  if (/duplicate key|23505/.test(raw)) {
    return 'רשומה כפולה — ייתכן שהפעולה כבר בוצעה.';
  }

  return error?.message || 'שגיאה בשמירת ההזמנה';
}

/** מיפוי שגיאות התחברות מנהלת */
export function mapAuthError(error) {
  const raw = errorBlob(error);

  if (/unauthorized_invalid_api_key|invalid.?api.?key/.test(raw)) {
    return 'מפתח API לא תקין. בדקי את הגדרות הסביבה.';
  }
  if (/invalid.?login|invalid.?credentials|email.?not.?confirmed|user not found/.test(raw)) {
    return 'מייל או סיסמה שגויים.';
  }
  if (/too many requests|rate.?limit/.test(raw)) {
    return 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות.';
  }
  if (/failed to fetch|networkerror|timeout/.test(raw)) {
    return 'בעיית רשת. בדקי את החיבור ונסי שוב.';
  }

  return error?.message || 'ההתחברות נכשלה. בדקי מייל וסיסמה.';
}

/** מיפוי כללי לפעולות אדמין (מחירים / חסימות / טעינה) */
export function mapAdminError(error, fallback = 'הפעולה נכשלה') {
  const mapped = mapBookingError(error);
  if (mapped && mapped !== (error?.message || 'שגיאה בשמירת ההזמנה')) {
    return mapped;
  }
  if (error?.message) return error.message;
  return fallback;
}

/**
 * יצירת הזמנה עם הגנת דאבל-בוקינג ב-DB (RPC + נעילה).
 * אם ה-RPC עדיין לא הותקן בסופבייס — נופל ל-insert רגיל.
 */
export async function createBookingSafe(payload) {
  const {
    plan_id,
    full_name,
    phone,
    profession,
    selected_date,
    selected_shift,
    total_price,
    status = 'reserved',
  } = payload;

  const { data, error } = await supabase.rpc('create_booking_safe', {
    p_plan_id: plan_id,
    p_full_name: full_name,
    p_phone: phone,
    p_profession: profession || null,
    p_selected_date: selected_date,
    p_selected_shift: selected_shift,
    p_total_price: total_price,
    p_status: status,
  });

  if (!error) {
    return { data, error: null };
  }

  // אם הפונקציה לא קיימת עדיין — fallback זמני
  const missingFn =
    error.code === 'PGRST202' ||
    /could not find the function|schema cache/i.test(error.message || '');

  if (!missingFn) {
    return { data: null, error };
  }

  const insertRes = await supabase
    .from('bookings')
    .insert([
      {
        plan_id,
        full_name,
        phone,
        profession,
        selected_date,
        selected_shift,
        total_price,
        status,
      },
    ])
    .select()
    .single();

  return { data: insertRes.data, error: insertRes.error };
}
