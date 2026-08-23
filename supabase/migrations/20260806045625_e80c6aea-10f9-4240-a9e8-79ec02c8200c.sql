GRANT UPDATE ON public.customer_verifications TO authenticated;

CREATE POLICY "Users can update own verification"
ON public.customer_verifications
FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);