ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS store_category text,
  ADD COLUMN IF NOT EXISTS store_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS tax_id text;

GRANT SELECT (store_category, store_address, postal_code, tax_id) ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;