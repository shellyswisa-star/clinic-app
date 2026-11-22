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

/** מיפוי שגיאות הזמנה / עדכון משבצת להודעות ברורות למשתמשת */
export function mapBookingError(error) {
  const raw = errorBlob(error);

  // באג SQL ישן: RAISE עם MESSAGE פעמיים — לטפל עד שמריצים את ה-SQL המעודכן
  if (/raise option already specified/.test(raw)) {
    return 'לא ניתן לשמור את המשבצת כרגע. נסי תאריך או משמרת אחרת, או רענני וראי אם המשבצת פנויה.';
  }
  if (raw.includes(SLOT_ALREADY_BOOKED) || raw.includes('already booked')) {
    return 'יש כבר הזמנה פעילה באותו יום/משמרת. שני תאריך או משמרת, או בטלי את ההזמנה החופפת.';
  }
  if (raw.includes(SLOT_BLOCKED)) {
    return 'המועד הזה חסום ביומן. שני תאריך/משמרת, או הסירי את החסימה בלשונית «חסימת משמרות».';
  }
  if (raw.includes('invalid_shift')) {
    return 'בחרי משמרת תקינה: בוקר, אחה״צ או יום מלא.';
  }
  if (/unauthorized_invalid_api_key|invalid.?api.?key|no api key/.test(raw)) {
    return 'חיבור למערכת נכשל. נסי לרענן את העמוד. אם זה נמשך — פני למנהלת.';
  }
  if (/jwt expired|session.?expired|not authenticated|invalid.?jwt/.test(raw)) {
    return 'פג תוקף ההתחברות. התחברי מחדש והמשיכי.';
  }
  if (/row-level security|rls|permission denied|42501/.test(raw)) {
    return 'אין הרשאה לבצע את הפעולה הזו. אם את מנהלת — התחברי מחדש.';
  }
  if (/failed to fetch|networkerror|network request failed|timeout|econnrefused/.test(raw)) {
    return 'אין חיבור יציב לשרת. בדקי אינטרנט ונסי שוב.';
  }
  if (/check constraint|23514|22p02|invalid input syntax/.test(raw)) {
    return 'חלק מהפרטים לא תקינים. בדקי תאריך, משמרת וסכום.';
  }
  if (/duplicate key|23505/.test(raw)) {
    return 'נראה שהפעולה כבר בוצעה. רענני את הרשימה לפני ניסיון נוסף.';
  }

  // לא להציג ג׳רגון טכני גולמי למשתמשת
  const msg = (error?.message || '').trim();
  if (!msg || /^(error|exception|p0001|xx000)\b/i.test(msg) || /raise option|sqlstate|postgres/i.test(msg)) {
    return 'משהו השתבש בשמירה. נסי שוב בעוד רגע.';
  }
  return msg;
}

/** מיפוי שגיאות התחברות מנהלת */
export function mapAuthError(error) {
  const raw = errorBlob(error);

  if (/unauthorized_invalid_api_key|invalid.?api.?key/.test(raw)) {
    return 'חיבור למערכת נכשל. רענני את העמוד או בדקי הגדרות סביבה.';
  }
  if (/invalid.?login|invalid.?credentials|email.?not.?confirmed|user not found/.test(raw)) {
    return 'המייל או הסיסמה לא נכונים. נסי שוב.';
  }
  if (/too many requests|rate.?limit/.test(raw)) {
    return 'יותר מדי ניסיונות. המתיני כמה דקות ונסי שוב.';
  }
  if (/failed to fetch|networkerror|timeout/.test(raw)) {
    return 'אין חיבור יציב. בדקי אינטרנט ונסי שוב.';
  }

  return 'לא הצלחנו להתחבר. בדקי מייל וסיסמה ונסי שוב.';
}

const GENERIC_BOOKING_FALLBACK = 'משהו השתבש בשמירה. נסי שוב בעוד רגע.';

/** מיפוי כללי לפעולות אדמין (מחירים / חסימות / טעינה) */
export function mapAdminError(error, fallback = 'הפעולה נכשלה') {
  if (!error || (typeof error === 'object' && !error.message && !error.code && !error.details)) {
    return fallback;
  }
  const mapped = mapBookingError(error);
  if (mapped === GENERIC_BOOKING_FALLBACK) return fallback;
  return mapped;
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
