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

/** מיפוי שגיאות הזמנה / עדכון משבצת להודעות ברורות */
export function mapBookingError(error) {
  const raw = errorBlob(error);

  if (/raise option already specified/.test(raw)) {
    return 'לא ניתן לשמור את המשבצת כרגע. נסו תאריך או משמרת אחרת, או רעננו וראו אם המשבצת פנויה.';
  }
  if (raw.includes(SLOT_ALREADY_BOOKED) || raw.includes('already booked')) {
    return 'יש כבר הזמנה פעילה באותו יום/משמרת. שנו תאריך או משמרת, או בטלו את ההזמנה החופפת.';
  }
  if (raw.includes(SLOT_BLOCKED)) {
    return 'המועד הזה חסום ביומן. שנו תאריך/משמרת, או הסירו את החסימה בלשונית «חסימת משמרות».';
  }
  if (raw.includes('invalid_shift')) {
    return 'בחרו משמרת תקינה: בוקר, אחה״צ או יום מלא.';
  }
  if (/unauthorized_invalid_api_key|invalid.?api.?key|no api key/.test(raw)) {
    return 'חיבור למערכת נכשל. נסו לרענן את העמוד. אם זה נמשך — פנו למנהלת הקליניקה.';
  }
  if (/jwt expired|session.?expired|not authenticated|invalid.?jwt/.test(raw)) {
    return 'פג תוקף ההתחברות. התחברו מחדש והמשיכו.';
  }
  if (/row-level security|rls|permission denied|42501/.test(raw)) {
    return 'אין הרשאה לבצע את הפעולה הזו. אם אתם מנהלים — התחברו מחדש.';
  }
  if (/failed to fetch|networkerror|network request failed|timeout|econnrefused/.test(raw)) {
    return 'אין חיבור יציב לשרת. בדקו אינטרנט ונסו שוב.';
  }
  if (/check constraint|23514|22p02|invalid input syntax/.test(raw)) {
    return 'חלק מהפרטים לא תקינים. בדקו תאריך, משמרת וסכום.';
  }
  if (/duplicate key|23505/.test(raw)) {
    return 'נראה שהפעולה כבר בוצעה. רעננו את הרשימה לפני ניסיון נוסף.';
  }

  const msg = (error?.message || '').trim();
  if (!msg || /^(error|exception|p0001|xx000)\b/i.test(msg) || /raise option|sqlstate|postgres/i.test(msg)) {
    return 'משהו השתבש בשמירה. נסו שוב בעוד רגע.';
  }
  return msg;
}

/** מיפוי שגיאות OTP לאזור אישי */
export function mapPersonalOtpError(error) {
  const raw = errorBlob(error);
  if (/21608|compliance.?profile|unverified.?numbers|verified.?caller/i.test(raw)) {
    return 'Twilio חוסם שליחה למספר זה. יש לאמת את המספר ב־Verified Caller IDs, או לאשר Primary Compliance Profile ב־Trust Hub.';
  }
  if (/sms_send_failed|error sending confirmation otp/i.test(raw)) {
    return 'שליחת ה־SMS נכשלה אצל ספק ה־SMS (Twilio). בדקו אימות מספר / Compliance Profile וחזרו שוב.';
  }
  if (/phone.?logins?.?are.?disabled|unsupported.?phone|sms.?provider.?not.?configured/i.test(raw)) {
    return 'שליחת קוד SMS עדיין לא מופעלת במערכת. פנו למנהלת להפעלת אימות טלפון בסופבייס.';
  }
  if (/rate.?limit|too.?many|over.?sms|sms.?sending/i.test(raw)) {
    return 'נשלחו יותר מדי קודים. המתינו כדקה ונסו שוב.';
  }
  if (/invalid.?otp|otp.?expired|token.?(has.?expired|is.?invalid)|code.?invalid|expired.?otp|otp_expired/i.test(raw)) {
    return 'הקוד שגוי או שפג תוקפו. בקשו קוד חדש ונסו שוב.';
  }
  if (/not_authenticated|42501/.test(raw)) {
    return 'יש לאמת את מספר הטלפון לפני הצגת ההזמנות.';
  }
  if (/failed to fetch|networkerror|timeout/i.test(raw)) {
    return 'אין חיבור יציב. בדקו אינטרנט ונסו שוב.';
  }
  return mapBookingError(error) || 'שליחת או אימות הקוד נכשלו. נסו שוב.';
}

/** מיפוי שגיאות התחברות מנהלת */
export function mapAuthError(error) {
  const raw = errorBlob(error);

  if (/unauthorized_invalid_api_key|invalid.?api.?key/.test(raw)) {
    return 'חיבור למערכת נכשל. רעננו את העמוד או בדקו הגדרות סביבה.';
  }
  if (/invalid.?login|invalid.?credentials|email.?not.?confirmed|user not found/.test(raw)) {
    return 'הדואר האלקטרוני או הסיסמה לא נכונים. נסו שוב.';
  }
  if (/too many requests|rate.?limit/.test(raw)) {
    return 'יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.';
  }
  if (/failed to fetch|networkerror|timeout/.test(raw)) {
    return 'אין חיבור יציב. בדקו אינטרנט ונסו שוב.';
  }

  return 'לא הצלחנו להתחבר. בדקו דואר אלקטרוני וסיסמה ונסו שוב.';
}

const GENERIC_BOOKING_FALLBACK = 'משהו השתבש בשמירה. נסו שוב בעוד רגע.';

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
 * אם ה-RPC עדיין לא הותקן / לא תומך ב-series — נופל ל-insert / RPC ישן.
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
    series_id = null,
    series_label = null,
  } = payload;

  const row = {
    plan_id,
    full_name,
    phone,
    profession,
    selected_date,
    selected_shift,
    total_price,
    status,
    ...(series_id ? { series_id } : {}),
    ...(series_label ? { series_label } : {}),
  };

  // ניסיון 1: RPC עם סדרה
  const withSeries = await supabase.rpc('create_booking_safe', {
    p_plan_id: plan_id,
    p_full_name: full_name,
    p_phone: phone,
    p_profession: profession || null,
    p_selected_date: selected_date,
    p_selected_shift: selected_shift,
    p_total_price: total_price,
    p_status: status,
    p_series_id: series_id,
    p_series_label: series_label,
  });

  if (!withSeries.error) {
    return { data: withSeries.data, error: null };
  }

  const missingOrWrongArity =
    withSeries.error.code === 'PGRST202' ||
    /could not find the function|schema cache|function.*does not exist|could not choose/i.test(
      withSeries.error.message || '',
    );

  // ניסיון 2: RPC ישן בלי סדרה + עדכון עמודות סדרה אם קיימות
  if (missingOrWrongArity) {
    const legacy = await supabase.rpc('create_booking_safe', {
      p_plan_id: plan_id,
      p_full_name: full_name,
      p_phone: phone,
      p_profession: profession || null,
      p_selected_date: selected_date,
      p_selected_shift: selected_shift,
      p_total_price: total_price,
      p_status: status,
    });

    if (!legacy.error) {
      if (series_id && legacy.data?.id) {
        await supabase
          .from('bookings')
          .update({ series_id, series_label })
          .eq('id', legacy.data.id);
      }
      return { data: legacy.data, error: null };
    }

    if (
      legacy.error.code === 'PGRST202' ||
      /could not find the function|schema cache/i.test(legacy.error.message || '')
    ) {
      const insertRes = await supabase.from('bookings').insert([row]).select().single();
      return { data: insertRes.data, error: insertRes.error };
    }

    return { data: null, error: legacy.error };
  }

  return { data: null, error: withSeries.error };
}
