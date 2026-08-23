create or replace function public.delete_product_unit_safe(_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owns boolean;
  has_history boolean;
begin
  select exists (
    select 1 from public.product_units pu
    join public.products p on p.id = pu.product_id
    join public.vendors v on v.id = p.vendor_id
    where pu.id = _unit_id and v.owner_id = auth.uid()
  ) into owns;

  if not owns then
    raise exception 'Unit not found or you do not have permission to delete it';
  end if;

  select exists (
    select 1 from public.booking_items bi where bi.product_unit_id = _unit_id
  ) into has_history;

  if has_history then
    raise exception 'This unit cannot be deleted because it has booking history. Please archive it instead.';
  end if;

  delete from public.product_units where id = _unit_id;
end;
$$;

revoke all on function public.delete_product_unit_safe(uuid) from public, anon;
grant execute on function public.delete_product_unit_safe(uuid) to authenticated;