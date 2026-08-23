create schema if not exists private;

-- Safe, definer-backed sources for the public views (views stay SECURITY INVOKER)
create or replace function private.public_product_units()
returns table(id uuid, product_id uuid, status text)
language sql
stable
security definer
set search_path = public
as $$
  select pu.id, pu.product_id, pu.status
  from public.product_units pu
  where pu.is_active = true;
$$;

create or replace function private.public_vendors()
returns table(
  id uuid, store_name text, description text, logo_url text,
  store_address text, subdistrict text, city text, state text,
  postal_code text, is_active boolean, deposit_per_item numeric,
  created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.store_name, v.description, v.logo_url,
         v.store_address, v.subdistrict, v.city, v.state,
         v.postal_code, v.is_active, v.deposit_per_item,
         v.created_at, v.updated_at
  from public.vendors v
  where v.is_active = true;
$$;

revoke all on function private.public_product_units() from public;
revoke all on function private.public_vendors() from public;
grant execute on function private.public_product_units() to anon, authenticated, service_role;
grant execute on function private.public_vendors() to anon, authenticated, service_role;

drop view if exists public.product_units_public;
create view public.product_units_public with (security_invoker = true) as
  select * from private.public_product_units();

drop view if exists public.vendors_public;
create view public.vendors_public with (security_invoker = true) as
  select * from private.public_vendors();

grant select on public.product_units_public to anon, authenticated;
grant select on public.vendors_public to anon, authenticated;

-- Remove broad row-level exposure of the base tables
drop policy if exists "Public can view active product units" on public.product_units;
drop policy if exists "Public can view active vendor display rows" on public.vendors;

revoke all on public.product_units from anon;
revoke all on public.vendors from anon;