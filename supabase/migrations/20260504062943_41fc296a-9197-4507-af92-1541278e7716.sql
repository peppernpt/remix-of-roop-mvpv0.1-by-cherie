DROP POLICY IF EXISTS "Public can view payment slips" ON storage.objects;

CREATE POLICY "Customer can list own payment slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-slips'
  AND auth.uid()::text = (storage.foldername(name))[1]
);