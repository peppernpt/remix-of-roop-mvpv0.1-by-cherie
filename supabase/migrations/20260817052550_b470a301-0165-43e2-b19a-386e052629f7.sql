ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS return_policy_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_policy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_address_snapshot text;

DROP VIEW IF EXISTS public.vendors_public;

CREATE VIEW public.vendors_public
WITH (security_invoker = true)
AS
SELECT
  id,
  store_name,
  description,
  logo_url,
  store_address,
  subdistrict,
  city,
  state,
  postal_code,
  is_active,
  deposit_per_item,
  created_at,
  updated_at
FROM public.vendors
WHERE is_active = true;

GRANT SELECT (store_address, postal_code, subdistrict) ON public.vendors TO anon, authenticated;
GRANT SELECT ON public.vendors_public TO anon, authenticated;