ALTER TABLE public.product_units
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamp with time zone;

CREATE OR REPLACE VIEW public.product_units_public AS
  SELECT id, product_id, status
  FROM public.product_units
  WHERE is_active = true;

GRANT SELECT ON public.product_units_public TO anon, authenticated;
GRANT ALL ON public.product_units_public TO service_role;