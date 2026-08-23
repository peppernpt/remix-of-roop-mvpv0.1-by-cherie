-- Add payment slip fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_slip_url text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz;

-- Create storage bucket for payment slips (public so vendor & customer can preview easily)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for payment-slips bucket
-- Path convention: {customer_id}/{booking_id}/{filename}
CREATE POLICY "Public can view payment slips"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-slips');

CREATE POLICY "Customer can upload own payment slip"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-slips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Customer can update own payment slip"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Customer can delete own payment slip"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);