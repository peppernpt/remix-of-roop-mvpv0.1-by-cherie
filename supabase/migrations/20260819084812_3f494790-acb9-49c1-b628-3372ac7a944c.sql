ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS rental_details_policy text;

DROP VIEW IF EXISTS public.vendors_public;
DROP FUNCTION IF EXISTS private.public_vendors();

CREATE FUNCTION private.public_vendors()
RETURNS TABLE(id uuid, store_name text, description text, logo_url text, store_address text, subdistrict text, city text, state text, postal_code text, is_active boolean, deposit_per_item numeric, created_at timestamptz, updated_at timestamptz, rental_details_policy text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select v.id, v.store_name, v.description, v.logo_url,
         v.store_address, v.subdistrict, v.city, v.state,
         v.postal_code, v.is_active, v.deposit_per_item,
         v.created_at, v.updated_at, v.rental_details_policy
  from public.vendors v
  where v.is_active = true;
$$;

CREATE VIEW public.vendors_public
WITH (security_invoker = true)
AS SELECT id, store_name, description, logo_url, store_address, subdistrict, city, state, postal_code, is_active, deposit_per_item, created_at, updated_at, rental_details_policy
FROM private.public_vendors();

GRANT EXECUTE ON FUNCTION private.public_vendors() TO anon, authenticated;
GRANT SELECT ON public.vendors_public TO anon, authenticated;