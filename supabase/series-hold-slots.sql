-- הרצה ב-Supabase SQL Editor אחרי booking-series.sql
-- מועדי סדרה (series_id) תופסים משבצת עד ביטול — לא רק 10 דקות של שריון בודד.
-- כך אי אפשר «להעביר» מועד על תאריך שכבר תפוס ע״י מועד אחר באותה סדרה.

drop function if exists public.booking_is_active_hold(text, timestamptz);

create or replace function public.booking_is_active_hold(
  p_status text,
  p_created_at timestamptz,
  p_series_id uuid default null
)
returns boolean
language sql
stable
as $$
  select
    p_status = 'paid'
    or (
      p_status = 'reserved'
      and p_series_id is not null
    )
    or (
      p_status = 'reserved'
      and p_created_at is not null
      and p_created_at > now() - interval '10 minutes'
    );
$$;

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
      and public.booking_is_active_hold(b.status, b.created_at, b.series_id)
      and public.booking_shifts_overlap(b.selected_shift, p_shift)
  );
$$;

grant execute on function public.booking_is_active_hold(text, timestamptz, uuid) to anon, authenticated;
grant execute on function public.booking_slot_conflicts(date, text, bigint) to anon, authenticated;
