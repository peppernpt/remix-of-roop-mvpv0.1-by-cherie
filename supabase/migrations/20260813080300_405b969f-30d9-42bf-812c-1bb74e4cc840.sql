CREATE OR REPLACE FUNCTION public.enforce_booking_item_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b_start date;
  b_end date;
  days int;
  p_rate numeric;
  p_deposit numeric;
  custom_price numeric;
  prev_days int;
  prev_price numeric;
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

  select price into custom_price
    from public.product_rental_rates
   where product_id = NEW.product_id and rental_days = days;

  if custom_price is not null then
    NEW.rental_price := custom_price;
  else
    select rental_days, price into prev_days, prev_price
      from public.product_rental_rates
     where product_id = NEW.product_id and rental_days < days
     order by rental_days desc
     limit 1;

    if prev_price is not null then
      NEW.rental_price := greatest(prev_price + p_rate * (days - prev_days), 0);
    else
      NEW.rental_price := p_rate * days;
    end if;
  end if;

  NEW.deposit_amount := p_deposit;
  return NEW;
end;
$function$;