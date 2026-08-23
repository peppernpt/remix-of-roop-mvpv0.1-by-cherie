create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.get_product_unit_blocked_bookings(_product_id uuid)
returns table(booking_id uuid, product_unit_id uuid, status text, rental_start date, rental_end date, delivery_method text, delivery_province text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, bi.product_unit_id, b.status, b.rental_start, b.rental_end,
         b.delivery_method, b.delivery_province
  from public.booking_items bi
  join public.bookings b on b.id = bi.booking_id
  join public.product_units pu on pu.id = bi.product_unit_id
  where bi.product_id = _product_id
    and pu.is_active = true
    and b.status in (
      'approved_waiting_payment','payment_submitted','paid','payment_confirmed',
      'to_deliver','on_delivery','on_rent','on_return','for_review'
    );
$$;

revoke all on function private.get_product_unit_blocked_bookings(uuid) from public;
grant execute on function private.get_product_unit_blocked_bookings(uuid) to anon, authenticated, service_role;

create or replace function public.get_product_unit_blocked_bookings(_product_id uuid)
returns table(booking_id uuid, product_unit_id uuid, status text, rental_start date, rental_end date, delivery_method text, delivery_province text)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select * from private.get_product_unit_blocked_bookings(_product_id);
$$;

revoke all on function public.get_product_unit_blocked_bookings(uuid) from public;
grant execute on function public.get_product_unit_blocked_bookings(uuid) to anon, authenticated, service_role;