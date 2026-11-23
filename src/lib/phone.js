/** מנרמל טלפון ישראלי לספרות מקומיות (05...), בלי מקפים */
export function normalizePhoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

export function phonesMatch(a, b) {
  const na = normalizePhoneDigits(a);
  const nb = normalizePhoneDigits(b);
  if (!na || !nb) return false;
  return na === nb;
}
