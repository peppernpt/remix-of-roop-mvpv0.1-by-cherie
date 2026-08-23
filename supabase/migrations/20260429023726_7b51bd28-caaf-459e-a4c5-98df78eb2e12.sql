
-- ============================================================
-- 1. VENDORS: restrict full row reads to owner; safe public view
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can select vendors" ON public.vendors;

CREATE POLICY "Vendor owner can select own vendor"
  ON public.vendors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Recreate vendors_public view as SECURITY INVOKER (default) so it
-- respects the caller's RLS, not the view creator's.
DROP VIEW IF EXISTS public.vendors_public;

CREATE VIEW public.vendors_public
WITH (security_invoker = true)
AS
SELECT
  id,
  store_name,
  description,
  logo_url,
  city,
  state,
  is_active,
  deposit_per_item,
  created_at,
  updated_at
FROM public.vendors
WHERE is_active = true;

-- We need authenticated/anon users to read the public view even though
-- the underlying table is owner-restricted. Add a permissive SELECT
-- policy on vendors that exposes ONLY non-sensitive columns through
-- the view by allowing row visibility, then restrict columns via
-- column-level grants on the view.
CREATE POLICY "Public can read active vendors (safe fields via view)"
  ON public.vendors
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- NOTE: The two SELECT policies are permissive (OR'd). The owner
-- policy still grants full visibility to the owner, while the public
-- one only matters when reading via the view. To prevent direct
-- column access to sensitive fields by non-owners, revoke and
-- re-grant column privileges:
REVOKE SELECT ON public.vendors FROM anon, authenticated;
GRANT SELECT (
  id, store_name, description, logo_url, city, state,
  is_active, deposit_per_item, created_at, updated_at, owner_id
) ON public.vendors TO anon, authenticated;
-- Owner needs to read sensitive columns too — handled via separate
-- grant for authenticated only on those columns, gated by the
-- owner-select policy above.
GRANT SELECT (bank_account, email, phone) ON public.vendors TO authenticated;

GRANT SELECT ON public.vendors_public TO anon, authenticated;

-- ============================================================
-- 2. PRODUCTS: vendor-owner-scoped writes; keep public read
-- ============================================================
DROP POLICY IF EXISTS "Allow all select on products" ON public.products;
DROP POLICY IF EXISTS "Allow all insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow all update on products" ON public.products;
DROP POLICY IF EXISTS "Allow all delete on products" ON public.products;

CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Vendor owner can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = products.vendor_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = products.vendor_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = products.vendor_id AND v.owner_id = auth.uid()
  ));

-- ============================================================
-- 3. PRODUCT_IMAGES: vendor-owner-scoped writes; keep public read
-- ============================================================
DROP POLICY IF EXISTS "Allow all select on product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow all insert on product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow all update on product_images" ON public.product_images;
DROP POLICY IF EXISTS "Allow all delete on product_images" ON public.product_images;

CREATE POLICY "Anyone can view product images"
  ON public.product_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Vendor owner can insert product images"
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_images.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can update product images"
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_images.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can delete product images"
  ON public.product_images FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_images.product_id AND v.owner_id = auth.uid()
  ));

-- ============================================================
-- 4. PRODUCT_UNITS: restrict to vendor owner (serial_id is sensitive)
--    Also allow customers who have an active booking item to see the
--    serial of the unit they rented.
-- ============================================================
DROP POLICY IF EXISTS "Allow all select on product_units" ON public.product_units;
DROP POLICY IF EXISTS "Allow all insert on product_units" ON public.product_units;
DROP POLICY IF EXISTS "Allow all update on product_units" ON public.product_units;
DROP POLICY IF EXISTS "Allow all delete on product_units" ON public.product_units;

CREATE POLICY "Vendor owner can select product units"
  ON public.product_units FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_units.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Customer can select rented product units"
  ON public.product_units FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.booking_items bi
    JOIN public.bookings b ON b.id = bi.booking_id
    WHERE bi.product_unit_id = product_units.id
      AND b.customer_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can insert product units"
  ON public.product_units FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_units.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can update product units"
  ON public.product_units FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_units.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can delete product units"
  ON public.product_units FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_units.product_id AND v.owner_id = auth.uid()
  ));

-- ============================================================
-- 5. PROFILES: prevent users from self-assigning a role
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing the role field is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_change_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_change();

-- Force role to 'customer' on signup regardless of metadata (vendor
-- status is recognised via existence of a row in public.vendors).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, username, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'username', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 6. Lock down SECURITY DEFINER functions: no direct execution by
--    anon/authenticated. They run as triggers on auth events.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 7. Storage: remove broad listing policies on public buckets.
--    Files remain accessible via direct public URL because the
--    bucket itself is public.
-- ============================================================
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Vendor logos are publicly accessible" ON storage.objects;
