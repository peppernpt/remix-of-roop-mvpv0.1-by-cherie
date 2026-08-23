ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status = ANY (ARRAY['pending_vendor_review','approved_waiting_payment','payment_submitted','paid','to_deliver','on_delivery','on_rent','on_return','for_review','completed','cancelled','rejected']));

UPDATE public.bookings b
SET status = 'for_review'
WHERE b.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM public.booking_items bi
    JOIN public.product_units pu ON pu.id = bi.product_unit_id
    WHERE bi.booking_id = b.id AND pu.status = 'for_review'
  );