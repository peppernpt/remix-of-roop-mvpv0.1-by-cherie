create or replace function public.enforce_booking_item_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b_start date;
  b_end date;
  days int;
  p_rate numeric;
  p_deposit numeric;
begin
  select rental_start, rental_end into b_start, b_end
    from public.bookings where id = NEW.booking_id;
  if b_start is null or b_end is null then
    raise exception 'Booking % not found or missing rental dates', NEW.booking_id;
  end if;
  -- Return-date policy: rental_end is the return day and is NOT counted.
  days := greatest(b_end - b_start, 1);

  select daily_rental_rate, coalesce(deposit_amount, 0)
    into p_rate, p_deposit
    from public.products where id = NEW.product_id;
  if p_rate is null then
    raise exception 'Product % not found', NEW.product_id;
  end if;

  NEW.rental_price := p_rate * days;
  NEW.deposit_amount := p_deposit;
  return NEW;
end;
$$;