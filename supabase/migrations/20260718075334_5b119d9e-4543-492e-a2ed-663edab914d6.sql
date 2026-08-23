
-- Server-side price enforcement for bookings/booking_items
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
  days := greatest((b_end - b_start) + 1, 1);

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

drop trigger if exists trg_enforce_booking_item_pricing on public.booking_items;
create trigger trg_enforce_booking_item_pricing
before insert or update on public.booking_items
for each row execute function public.enforce_booking_item_pricing();

-- Recompute booking totals from items
create or replace function public.recompute_booking_totals(_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_total numeric;
  d_total numeric;
  d_fee numeric;
  disc numeric;
  effective_rental numeric;
begin
  select coalesce(sum(rental_price),0), coalesce(sum(deposit_amount),0)
    into r_total, d_total
    from public.booking_items where booking_id = _booking;

  select coalesce(delivery_fee,0), discounted_rental_total
    into d_fee, disc
    from public.bookings where id = _booking;

  effective_rental := coalesce(disc, r_total);

  update public.bookings
     set rental_total = r_total,
         deposit_total = d_total,
         grand_total = effective_rental + d_total + coalesce(d_fee,0)
   where id = _booking;
end;
$$;

create or replace function public.trg_recompute_booking_totals_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_booking_totals(OLD.booking_id);
    return OLD;
  else
    perform public.recompute_booking_totals(NEW.booking_id);
    return NEW;
  end if;
end;
$$;

drop trigger if exists trg_booking_items_totals on public.booking_items;
create trigger trg_booking_items_totals
after insert or update or delete on public.booking_items
for each row execute function public.trg_recompute_booking_totals_items();

-- On bookings insert, zero out client-supplied totals (items trigger will fill them)
create or replace function public.enforce_booking_totals_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    NEW.rental_total := 0;
    NEW.deposit_total := 0;
    NEW.delivery_fee := coalesce(NEW.delivery_fee, 0);
    NEW.grand_total := coalesce(NEW.delivery_fee, 0);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_bookings_defaults on public.bookings;
create trigger trg_bookings_defaults
before insert on public.bookings
for each row execute function public.enforce_booking_totals_defaults();

-- On bookings UPDATE of delivery_fee/discounted_rental_total, recompute grand_total
create or replace function public.trg_recompute_booking_totals_self()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_rental numeric;
begin
  effective_rental := coalesce(NEW.discounted_rental_total, NEW.rental_total);
  NEW.grand_total := effective_rental + coalesce(NEW.deposit_total,0) + coalesce(NEW.delivery_fee,0);
  return NEW;
end;
$$;

drop trigger if exists trg_bookings_recompute_self on public.bookings;
create trigger trg_bookings_recompute_self
before update of delivery_fee, discounted_rental_total, rental_total, deposit_total on public.bookings
for each row execute function public.trg_recompute_booking_totals_self();

-- Storage: allow vendors to read payment slips for their bookings
drop policy if exists "Vendor can read booking payment slips" on storage.objects;
create policy "Vendor can read booking payment slips"
on storage.objects for select
using (
  bucket_id = 'payment-slips'
  and exists (
    select 1 from public.bookings b
    join public.vendors v on v.id = b.vendor_id
    where v.owner_id = auth.uid()
      and b.id::text = (storage.foldername(name))[2]
  )
);
