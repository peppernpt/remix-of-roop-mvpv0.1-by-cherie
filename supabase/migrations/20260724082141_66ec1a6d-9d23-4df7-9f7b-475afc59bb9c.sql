ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS policy_acknowledged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS policy_acknowledged_at timestamp with time zone;

COMMENT ON COLUMN public.bookings.policy_acknowledged IS 'Customer confirmed they read and agreed to the request policy before sending the booking.';
COMMENT ON COLUMN public.bookings.policy_acknowledged_at IS 'Timestamp when the customer agreed to the request policy.';