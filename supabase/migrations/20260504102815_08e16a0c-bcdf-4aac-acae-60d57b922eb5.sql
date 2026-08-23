
-- Allow vendors to read profile rows of customers who have booked from them
CREATE POLICY "Vendors can view customer profiles for their bookings"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.vendors v ON v.id = b.vendor_id
    WHERE b.customer_id = profiles.id
      AND v.owner_id = auth.uid()
  )
);

-- Allow vendors to read addresses of customers who have booked from them
CREATE POLICY "Vendors can view addresses of their booking customers"
ON public.customer_addresses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.vendors v ON v.id = b.vendor_id
    WHERE b.customer_id = customer_addresses.customer_id
      AND v.owner_id = auth.uid()
  )
);
