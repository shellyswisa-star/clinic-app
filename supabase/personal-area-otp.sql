-- אזור אישי מאובטח ב־OTP (Supabase Phone Auth)
-- להריץ אחרי personal-area-lookup.sql
--
-- חובה בפאנל Supabase:
-- 1) Authentication → Providers → Phone → Enable
-- 2) לחבר Twilio (או ספק SMS אחר שסופבייס תומך בו)
-- 3) Authentication → Settings → להפעיל SMS OTP
--
-- אחרי אימות SMS, הקליינט קורא ל־get_my_bookings() — רק למשתמשת המאומתת.

create or replace function public.normalize_il_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when d = '' then ''
    when d like '972%' then '0' || substr(d, 4)
    else d
  end
  from (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
  ) raw;
$$;

create or replace function public.get_my_bookings()
returns setof public.bookings
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_auth_phone text;
  v_norm text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'not_authenticated';
  end if;

  v_auth_phone := auth.jwt() ->> 'phone';
  v_norm := public.normalize_il_phone(v_auth_phone);

  if v_norm is null or length(v_norm) < 9 then
    raise exception using
      errcode = '42501',
      message = 'not_authenticated';
  end if;

  return query
  select b.*
  from public.bookings b
  where public.normalize_il_phone(b.phone) = v_norm
  order by b.selected_date asc nulls last, b.created_at desc;
end;
$$;

revoke all on function public.get_my_bookings() from public;
grant execute on function public.get_my_bookings() to authenticated;
grant execute on function public.normalize_il_phone(text) to anon, authenticated;
