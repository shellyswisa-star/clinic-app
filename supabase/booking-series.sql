-- קישור הזמנות לסדרה (מפגש שבועי / השכרה חודשית)
-- להריץ ב-Supabase SQL Editor אחרי prevent-double-booking.sql

alter table public.bookings
  add column if not exists series_id uuid,
  add column if not exists series_label text;

create index if not exists bookings_series_id_idx
  on public.bookings (series_id);

-- RPC מעודכן: תומך ב-series_id / series_label (אופציונלי)
create or replace function public.create_booking_safe(
  p_plan_id text,
  p_full_name text,
  p_phone text,
  p_profession text,
  p_selected_date date,
  p_selected_shift text,
  p_total_price numeric,
  p_status text default 'reserved',
  p_series_id uuid default null,
  p_series_label text default null
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
    raise exception using errcode = '22023', message = 'invalid_shift';
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
    status,
    series_id,
    series_label
  ) values (
    p_plan_id,
    p_full_name,
    p_phone,
    p_profession,
    p_selected_date,
    p_selected_shift,
    p_total_price,
    p_status,
    p_series_id,
    p_series_label
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_booking_safe(
  text, text, text, text, date, text, numeric, text, uuid, text
) to anon, authenticated;
