DROP POLICY IF EXISTS "Vendor owner can update" ON public.vendors;
CREATE POLICY "Vendor owner can update"
ON public.vendors
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Public can read vendor logos" ON storage.objects;
CREATE POLICY "Public can read vendor logos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vendor-logos');