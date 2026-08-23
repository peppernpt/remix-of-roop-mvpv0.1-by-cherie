
-- Helper: does this vendor owner have a booking with this customer?
CREATE OR REPLACE FUNCTION public.vendor_owner_has_booking_with_customer(_owner uuid, _customer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    JOIN vendors v ON v.id = b.vendor_id
    WHERE v.owner_id = _owner AND b.customer_id = _customer
  );
$$;

-- Helper: does this customer have a booking with this vendor?
CREATE OR REPLACE FUNCTION public.customer_has_booking_with_vendor(_customer uuid, _vendor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.customer_id = _customer AND b.vendor_id = _vendor
  );
$$;

-- Helper: is this user the owner of this vendor?
CREATE OR REPLACE FUNCTION public.is_vendor_owner(_user uuid, _vendor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM vendors v WHERE v.id = _vendor AND v.owner_id = _user);
$$;

-- Replace recursive policies
DROP POLICY IF EXISTS "Vendors can view customer profiles for their bookings" ON public.profiles;
CREATE POLICY "Vendors can view customer profiles for their bookings"
ON public.profiles FOR SELECT
USING (public.vendor_owner_has_booking_with_customer(auth.uid(), profiles.id));

DROP POLICY IF EXISTS "Customer with booking can view vendor" ON public.vendors;
CREATE POLICY "Customer with booking can view vendor"
ON public.vendors FOR SELECT
USING (public.customer_has_booking_with_vendor(auth.uid(), vendors.id));

DROP POLICY IF EXISTS "Users can select own bookings" ON public.bookings;
CREATE POLICY "Users can select own bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = customer_id OR public.is_vendor_owner(auth.uid(), vendor_id));

DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own bookings"
ON public.bookings FOR UPDATE
USING (auth.uid() = customer_id OR public.is_vendor_owner(auth.uid(), vendor_id));
