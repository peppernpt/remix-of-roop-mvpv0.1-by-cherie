GRANT UPDATE ON public.booking_items TO authenticated;

DROP POLICY IF EXISTS "Vendor owner can update booking items" ON public.booking_items;
CREATE POLICY "Vendor owner can update booking items"
ON public.booking_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.vendors v ON v.id = b.vendor_id
    WHERE b.id = booking_items.booking_id AND v.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.vendors v ON v.id = b.vendor_id
    WHERE b.id = booking_items.booking_id AND v.owner_id = auth.uid()
  )
);