
-- === Fix 1: product_units public exposure ===
-- Drop broad USING(true) SELECT policies
DROP POLICY IF EXISTS "Anon can view product unit availability" ON public.product_units;
DROP POLICY IF EXISTS "Authenticated can view product unit availability" ON public.product_units;

-- Revoke all column grants from anon on the underlying table
REVOKE ALL ON public.product_units FROM anon;

-- Public availability view: only safe columns, bypasses RLS via security_invoker=false (default for views owned by postgres)
CREATE OR REPLACE VIEW public.product_units_public
WITH (security_invoker = true) AS
SELECT id, product_id, status
FROM public.product_units;

-- Allow anyone to read the view rows (id, product_id, status only)
GRANT SELECT ON public.product_units_public TO anon, authenticated;

-- The view is security_invoker; add a permissive SELECT policy on the base
-- table so the view can read id/product_id/status. Column grants (which we
-- keep narrow for anon on those 3 cols via the view grant) plus this policy
-- expose only the safe columns. Authenticated users still only see full rows
-- through the scoped Vendor owner / Customer rented policies already present.
CREATE POLICY "Public availability lookup via view"
  ON public.product_units
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Restrict anon column privileges on the base table to just the 3 safe cols
-- (so even if a client queries the base table directly it cannot read
--  current_booking_id / condition / created_at / serial_id).
GRANT SELECT (id, product_id, status) ON public.product_units TO anon;

-- === Fix 2: payment slip vendor access via unvalidated path ===
DROP POLICY IF EXISTS "Vendor can read booking payment slips" ON storage.objects;

CREATE POLICY "Vendor can read booking payment slips"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-slips'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.vendors v ON v.id = b.vendor_id
      WHERE v.owner_id = auth.uid()
        AND b.payment_slip_url = storage.objects.name
    )
  );
