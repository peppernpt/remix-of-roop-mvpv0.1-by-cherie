ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS delivery_tracking_url text,
  ADD COLUMN IF NOT EXISTS delivery_tracking_updated_at timestamp with time zone;