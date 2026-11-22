-- הרצה ב-Supabase SQL Editor
-- מניעת דאבל-בוקינג ברמת DB: נעילת טרנזקציה + בדיקת התנגשות
-- חלון שריון זמני: 10 דקות (תואם לקליינט)

create or replace function public.booking_shifts_overlap(a text, b text)
returns boolean
language sql
immutable
as $$
  select a is not null and b is not null and (
    a = b or a = 'full-day' or b = 'full-day'
  );
$$;

create or replace function public.booking_is_active_hold(p_status text, p_created_at timestamptz)
returns boolean
language sql
stable
as $$
  select
    p_status = 'paid'
    or (
      p_status = 'reserved'
      and p_created_at is not null
      and p_created_at > now() - interval '10 minutes'
    );
$$;

-- אם נוצרה גרסה קודמת עם uuid — מסירים אותה
drop function if exists public.booking_slot_conflicts(date, text, uuid);

create or replace function public.booking_slot_conflicts(
  p_date date,
  p_shift text,
  p_exclude_id bigint default null
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.bookings b
    where b.selected_date = p_date
      and (p_exclude_id is null or b.id is distinct from p_exclude_id)
      and public.booking_is_active_hold(b.status, b.created_at)
      and public.booking_shifts_overlap(b.selected_shift, p_shift)
  );
$$;

create or replace function public.booking_slot_is_blocked(
  p_date date,
  p_shift text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.blocked_slots bs
    where (
      bs.blocked_date = p_date
      or (
        bs.day_index is not null
        and bs.day_index = extract(dow from p_date)::int
      )
    )
    and public.booking_shifts_overlap(bs.shift, p_shift)
  );
$$;

-- נעילת משמרות ליום נתון (full-day נועל בוקר+אחה״צ)
create or replace function public.lock_booking_slot(p_date date, p_shift text)
returns void
language plpgsql
as $$
begin
  if p_shift = 'full-day' then
    perform pg_advisory_xact_lock(hashtext(p_date::text || ':morning'));
    perform pg_advisory_xact_lock(hashtext(p_date::text || ':afternoon'));
  elsif p_shift = 'morning' then
    perform pg_advisory_xact_lock(hashtext(p_date::text || ':morning'));
  elsif p_shift = 'afternoon' then
    perform pg_advisory_xact_lock(hashtext(p_date::text || ':afternoon'));
  else
    raise exception 'invalid_shift' using errcode = '22023';
  end if;
end;
$$;

-- טריגר: הגנה גם על insert/update ישיר (אדמין / SDK)
create or replace function public.prevent_double_booking_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.selected_date is null or new.selected_shift is null then
    return new;
  end if;

  -- ביטול לא צריך לבדוק תפוסה
  if new.status = 'cancelled' then
    return new;
  end if;

  -- עדכון בלי שינוי תאריך/משמרת (שם, טלפון, מחיר, סטטוס) — לא חוסמים מחדש.
  -- אחרת שמירת עריכה רגילה נכשלת אם נוספה חסימה אחרי ההזמנה המקורית.
  if tg_op = 'UPDATE'
     and old.selected_date is not distinct from new.selected_date
     and old.selected_shift is not distinct from new.selected_shift then
    return new;
  end if;

  perform public.lock_booking_slot(new.selected_date, new.selected_shift);

  if public.booking_slot_is_blocked(new.selected_date, new.selected_shift) then
    -- אל תשתמשי ב-USING message יחד עם מחרוזת אחרי RAISE — Postgres זורק
    -- "RAISE option already specified: MESSAGE"
    raise exception using
      errcode = 'P0001',
      message = 'slot_blocked',
      hint = 'choose_another_slot';
  end if;

  if public.booking_slot_conflicts(new.selected_date, new.selected_shift, new.id) then
    raise exception using
      errcode = 'P0001',
      message = 'slot_already_booked',
      hint = 'choose_another_slot';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_prevent_double_booking on public.bookings;
create trigger bookings_prevent_double_booking
before insert or update of selected_date, selected_shift, status
on public.bookings
for each row
execute function public.prevent_double_booking_trigger();

-- RPC מומלץ מהקליינט: נעילה + insert אטומיים
create or replace function public.create_booking_safe(
  p_plan_id text,
  p_full_name text,
  p_phone text,
  p_profession text,
  p_selected_date date,
  p_selected_shift text,
  p_total_price numeric,
  p_status text default 'reserved'
)
returns public.bookings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.bookings;
begin
  if p_selected_shift not in ('morning', 'afternoon', 'full-day') then
    raise exception 'invalid_shift' using errcode = '22023';
  end if;

  if p_status is null then
    p_status := 'reserved';
  end if;

  perform public.lock_booking_slot(p_selected_date, p_selected_shift);

  if public.booking_slot_is_blocked(p_selected_date, p_selected_shift) then
    raise exception using
      errcode = 'P0001',
      message = 'slot_blocked',
      hint = 'choose_another_slot';
  end if;

  if public.booking_slot_conflicts(p_selected_date, p_selected_shift, null) then
    raise exception using
      errcode = 'P0001',
      message = 'slot_already_booked',
      hint = 'choose_another_slot';
  end if;

  insert into public.bookings (
    plan_id,
    full_name,
    phone,
    profession,
    selected_date,
    selected_shift,
    total_price,
    status
  ) values (
    p_plan_id,
    p_full_name,
    p_phone,
    p_profession,
    p_selected_date,
    p_selected_shift,
    p_total_price,
    p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_booking_safe(
  text, text, text, text, date, text, numeric, text
) to anon, authenticated;

grant execute on function public.booking_slot_conflicts(date, text, bigint) to anon, authenticated;
grant execute on function public.booking_slot_is_blocked(date, text) to anon, authenticated;
