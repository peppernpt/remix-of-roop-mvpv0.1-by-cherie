ALTER VIEW public.product_units_public SET (security_invoker = true);

DROP POLICY IF EXISTS "Public availability lookup via view" ON public.product_units;

CREATE POLICY "Public can view active product units"
ON public.product_units
FOR SELECT
TO anon, authenticated
USING (is_active = true);

GRANT SELECT (id, product_id, status, is_active) ON public.product_units TO anon;
GRANT SELECT (id, product_id, status, is_active) ON public.product_units TO authenticated;
GRANT SELECT ON public.product_units_public TO anon, authenticated;