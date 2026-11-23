-- הרצה ב-Supabase SQL Editor
-- חיפוש הזמנות לאזור אישי לפי טלפון (מנרמל ספרות / 972→0)

create or replace function public.get_bookings_by_phone(p_phone text)
returns setof public.bookings
language sql
stable
security invoker
set search_path = public
as $$
  with want as (
    select case
      when d like '972%' then '0' || substr(d, 4)
      else d
    end as phone_norm
    from (
      select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
    ) raw
  )
  select b.*
  from public.bookings b
  cross join want w
  where length(w.phone_norm) >= 9
    and case
      when regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') like '972%'
        then '0' || substr(regexp_replace(coalesce(b.phone, ''), '\D', '', 'g'), 4)
      else regexp_replace(coalesce(b.phone, ''), '\D', '', 'g')
    end = w.phone_norm
  order by b.selected_date asc nulls last, b.created_at desc;
$$;

grant execute on function public.get_bookings_by_phone(text) to anon, authenticated;
