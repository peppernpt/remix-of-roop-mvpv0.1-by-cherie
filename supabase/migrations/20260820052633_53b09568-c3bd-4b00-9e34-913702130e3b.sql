ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS rental_policy_image_urls text[];

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS store_policy_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_policy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_policy_snapshot text,
  ADD COLUMN IF NOT EXISTS store_policy_image_urls_snapshot text[];

DROP VIEW IF EXISTS public.vendors_public;
DROP FUNCTION IF EXISTS private.public_vendors();

CREATE FUNCTION private.public_vendors()
RETURNS TABLE(id uuid, store_name text, description text, logo_url text, store_address text, subdistrict text, city text, state text, postal_code text, is_active boolean, deposit_per_item numeric, created_at timestamptz, updated_at timestamptz, rental_details_policy text, rental_policy_image_urls text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select v.id, v.store_name, v.description, v.logo_url,
         v.store_address, v.subdistrict, v.city, v.state,
         v.postal_code, v.is_active, v.deposit_per_item,
         v.created_at, v.updated_at, v.rental_details_policy,
         v.rental_policy_image_urls
  from public.vendors v
  where v.is_active = true;
$$;

CREATE VIEW public.vendors_public
WITH (security_invoker = true)
AS SELECT id, store_name, description, logo_url, store_address, subdistrict, city, state, postal_code, is_active, deposit_per_item, created_at, updated_at, rental_details_policy, rental_policy_image_urls
FROM private.public_vendors();

GRANT EXECUTE ON FUNCTION private.public_vendors() TO anon, authenticated;
GRANT SELECT ON public.vendors_public TO anon, authenticated;