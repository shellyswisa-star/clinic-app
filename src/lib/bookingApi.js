import { supabase } from '../supabaseClient';

export const SLOT_ALREADY_BOOKED = 'slot_already_booked';
export const SLOT_BLOCKED = 'slot_blocked';

export function mapBookingError(error) {
  const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  if (raw.includes('slot_already_booked')) {
    return 'המשמרת כבר נתפסה. נסי תאריך או משמרת אחרת.';
  }
  if (raw.includes('slot_blocked')) {
    return 'המשמרת חסומה במערכת. נסי מועד אחר.';
  }
  if (raw.includes('invalid_shift')) {
    return 'משמרת לא תקינה.';
  }
  return error?.message || 'שגיאה בשמירת ההזמנה';
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
