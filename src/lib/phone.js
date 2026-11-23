/** מנרמל טלפון ישראלי לספרות מקומיות (05...), בלי מקפים */
export function normalizePhoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

/** המרה ל־E.164 לאימות SMS בסופבייס (+972...) */
export function toE164Israel(phone) {
  const local = normalizePhoneDigits(phone);
  if (!local || local.length < 9) return null;
  if (local.startsWith('0')) return `+972${local.slice(1)}`;
  return `+${local}`;
}

export function phonesMatch(a, b) {
  const na = normalizePhoneDigits(a);
  const nb = normalizePhoneDigits(b);
  if (!na || !nb) return false;
  return na === nb;
}
