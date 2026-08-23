DROP POLICY IF EXISTS "Public can read vendor logos" ON storage.objects;
CREATE POLICY "Vendors can read own logo"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'vendor-logos' AND (auth.uid())::text = (storage.foldername(name))[1]);