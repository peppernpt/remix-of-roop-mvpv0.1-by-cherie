
-- Fix RLS so vendors can see/update bookings owned by their vendor row
DROP POLICY IF EXISTS "Users can select own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;

CREATE POLICY "Users can select own bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (
  auth.uid() = customer_id
  OR EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = bookings.vendor_id AND v.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update own bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (
  auth.uid() = customer_id
  OR EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = bookings.vendor_id AND v.owner_id = auth.uid()
  )
);

-- Fix booking_items SELECT for vendors
DROP POLICY IF EXISTS "Users can select own booking items" ON public.booking_items;

CREATE POLICY "Users can select own booking items"
ON public.booking_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_items.booking_id
      AND (
        b.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.vendors v
          WHERE v.id = b.vendor_id AND v.owner_id = auth.uid()
        )
      )
  )
);
