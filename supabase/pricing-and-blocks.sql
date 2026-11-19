-- הרצה ב-Supabase SQL Editor
-- מחירים לניהול מדשבורד + חסימת משמרות קבועות/חד-פעמיות

create table if not exists public.pricing (
  id text primary key,
  label text not null,
  amount integer not null check (amount >= 0),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  day_index integer check (day_index is null or (day_index >= 0 and day_index <= 4)),
  blocked_date date,
  shift text not null check (shift in ('morning', 'afternoon', 'full-day')),
  note text,
  created_at timestamptz not null default now(),
  constraint blocked_slots_target_check check (
    (day_index is not null and blocked_date is null)
    or (day_index is null and blocked_date is not null)
  )
);

create index if not exists blocked_slots_date_idx on public.blocked_slots (blocked_date);
create index if not exists blocked_slots_day_idx on public.blocked_slots (day_index);

-- ערכי התחלה (לא דורסים אם כבר קיימים)
insert into public.pricing (id, label, amount, sort_order) values
  ('session', 'ססיה שבועית', 800, 1),
  ('hourly', 'מחיר לשעה (תצוגה)', 60, 2),
  ('hourly_shift', 'משמרת שעתית (4 שעות)', 260, 3),
  ('daily', 'יום מלא', 500, 4),
  ('monthly_3', 'חודשי — 3 ימים', 2200, 5),
  ('monthly_4', 'חודשי — 4 ימים', 2800, 6),
  ('monthly_5', 'חודשי — 5 ימים', 3500, 7)
on conflict (id) do nothing;

-- חסימה קבועה שהייתה בקוד: יום שלישי בוקר
insert into public.blocked_slots (day_index, blocked_date, shift, note)
select 2, null, 'morning', 'חסימה קבועה קיימת'
where not exists (
  select 1 from public.blocked_slots
  where day_index = 2 and shift = 'morning' and blocked_date is null
);

alter table public.pricing enable row level security;
alter table public.blocked_slots enable row level security;

drop policy if exists "public read pricing" on public.pricing;
drop policy if exists "auth manage pricing" on public.pricing;
drop policy if exists "public read blocked_slots" on public.blocked_slots;
drop policy if exists "auth manage blocked_slots" on public.blocked_slots;

-- ציבור קורא מחירים וחסימות לצורך האתר
create policy "public read pricing"
on public.pricing for select
to anon, authenticated
using (true);

create policy "public read blocked_slots"
on public.blocked_slots for select
to anon, authenticated
using (true);

-- רק מנהלת מחוברת מעדכנת
create policy "auth manage pricing"
on public.pricing for all
to authenticated
using (true)
with check (true);

create policy "auth manage blocked_slots"
on public.blocked_slots for all
to authenticated
using (true)
with check (true);
