-- הרצה ב-Supabase SQL Editor (אחרי prevent-double-booking.sql)
-- מאפשרת למנהלת מחוברת לערוך/להזיז הזמנה גם אם היום חסום ביומן.
-- חסימות ממשיכות לחסום הזמנות מהאתר הציבורי.

create or replace function public.prevent_double_booking_trigger()
returns trigger
language plpgsql
as $$
begin
  if new.selected_date is null or new.selected_shift is null then
    return new;
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.selected_date is not distinct from new.selected_date
     and old.selected_shift is not distinct from new.selected_shift then
    return new;
  end if;

  perform public.lock_booking_slot(new.selected_date, new.selected_shift);

  if auth.uid() is null
     and public.booking_slot_is_blocked(new.selected_date, new.selected_shift) then
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
