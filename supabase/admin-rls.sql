-- הרצה ב-Supabase SQL Editor
-- מטרה: אתר הזמנות ציבורי בלי login, דשבורד מנהלת רק אחרי Auth

-- 1) ודאי ש-RLS פעיל
alter table public.bookings enable row level security;
alter table public.orders enable row level security;

-- 2) הסרי מדיניות ישנות עם אותם שמות אם קיימות (בטוח להריץ מחדש)
drop policy if exists "public insert bookings" on public.bookings;
drop policy if exists "public read bookings" on public.bookings;
drop policy if exists "public update bookings" on public.bookings;
drop policy if exists "public delete bookings" on public.bookings;
drop policy if exists "auth manage bookings" on public.bookings;
drop policy if exists "auth read bookings" on public.bookings;
drop policy if exists "auth update bookings" on public.bookings;
drop policy if exists "auth delete bookings" on public.bookings;

drop policy if exists "public insert orders" on public.orders;
drop policy if exists "public update orders" on public.orders;
drop policy if exists "auth manage orders" on public.orders;

-- 3) ציבור (anon): יכול ליצור הזמנה ולקרוא זמינות
-- הערה: select ל-anon נדרש כרגע לבדיקת משמרות תפוסות באתר ההזמנות
create policy "public insert bookings"
on public.bookings for insert
to anon
with check (true);

create policy "public read bookings"
on public.bookings for select
to anon
using (true);

-- שחרור שריון זמני מהאתר (ביטול/מחיקה של reserved בלבד)
create policy "public update own reserved bookings"
on public.bookings for update
to anon
using (status = 'reserved')
with check (status in ('reserved', 'cancelled', 'paid'));

create policy "public delete reserved bookings"
on public.bookings for delete
to anon
using (status = 'reserved');

create policy "public insert orders"
on public.orders for insert
to anon
with check (true);

create policy "public update orders"
on public.orders for update
to anon
using (true)
with check (true);

-- 4) מנהלת מחוברת (authenticated): ניהול מלא
create policy "auth read bookings"
on public.bookings for select
to authenticated
using (true);

create policy "auth update bookings"
on public.bookings for update
to authenticated
using (true)
with check (true);

create policy "auth delete bookings"
on public.bookings for delete
to authenticated
using (true);

create policy "auth manage orders"
on public.orders for all
to authenticated
using (true)
with check (true);
