-- אחרי ש־OTP חי בפרודקשן והאפליקציה כבר לא קוראת ל־get_bookings_by_phone
-- מריצים ב־SQL Editor כדי לסגור חיפוש הזמנות בלי אימות SMS.
--
-- get_my_bookings() נשאר ל־authenticated בלבד (personal-area-otp.sql).

revoke execute on function public.get_bookings_by_phone(text) from anon;
-- אופציונלי: גם מ־authenticated אם רוצים רק get_my_bookings
-- revoke execute on function public.get_bookings_by_phone(text) from authenticated;
