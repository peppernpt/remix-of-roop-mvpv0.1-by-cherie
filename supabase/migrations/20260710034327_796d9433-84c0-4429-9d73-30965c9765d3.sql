
-- 1) product_units: hide serial_id from anonymous users
DROP POLICY IF EXISTS "Public can view product unit availability" ON public.product_units;

CREATE POLICY "Anon can view product unit availability"
  ON public.product_units FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can view product unit availability"
  ON public.product_units FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.product_units FROM anon;
GRANT SELECT (id, product_id, status, condition, current_booking_id, created_at)
  ON public.product_units TO anon;

-- 2) products: hide drafts/inactive from public, but keep visibility for owners & customers-with-bookings
UPDATE public.products SET publish_status = 'published' WHERE publish_status IS DISTINCT FROM 'published';
ALTER TABLE public.products ALTER COLUMN publish_status SET DEFAULT 'published';

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;

CREATE POLICY "Public can view active published products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (publish_status = 'published' AND is_active = true);

CREATE POLICY "Vendor owner can view own products"
  ON public.products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = products.vendor_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Customer can view products in own bookings"
  ON public.products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.booking_items bi
    JOIN public.bookings b ON b.id = bi.booking_id
    WHERE bi.product_id = products.id AND b.customer_id = auth.uid()
  ));

-- 3) vendors: remove broad public read on base table; expose safe fields via vendors_public view.
--    Customers with an active booking still need to read the vendor's bank_account etc.
DROP POLICY IF EXISTS "Public can read active vendors (safe fields via view)" ON public.vendors;

CREATE POLICY "Customer with booking can view vendor"
  ON public.vendors FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vendor_id = vendors.id AND b.customer_id = auth.uid()
  ));

GRANT SELECT ON public.vendors_public TO anon, authenticated;
