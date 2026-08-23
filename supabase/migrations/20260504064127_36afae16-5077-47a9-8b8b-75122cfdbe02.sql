ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'pending_vendor_review',
  'approved_waiting_payment',
  'payment_submitted',
  'paid',
  'to_deliver',
  'on_delivery',
  'on_rent',
  'on_return',
  'completed',
  'cancelled'
));