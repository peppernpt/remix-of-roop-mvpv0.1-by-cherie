
ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS product_units_status_check;
ALTER TABLE public.product_units ADD CONSTRAINT product_units_status_check
  CHECK (status = ANY (ARRAY['available','reserved','to_deliver','on_delivery','on_rent','on_return','for_review']));

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.product_units ADD COLUMN IF NOT EXISTS current_booking_id UUID;
