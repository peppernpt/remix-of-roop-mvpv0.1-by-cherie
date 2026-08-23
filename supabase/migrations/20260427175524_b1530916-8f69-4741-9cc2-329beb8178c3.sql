CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, username, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'username', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END$$;

-- Add bank_account column to vendors (optional, for vendor MVP)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Storage bucket for vendor logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-logos', 'vendor-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for vendor logos
DROP POLICY IF EXISTS "Vendor logos are publicly accessible" ON storage.objects;
CREATE POLICY "Vendor logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-logos');

DROP POLICY IF EXISTS "Vendors can upload own logo" ON storage.objects;
CREATE POLICY "Vendors can upload own logo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Vendors can update own logo" ON storage.objects;
CREATE POLICY "Vendors can update own logo"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Vendors can delete own logo" ON storage.objects;
CREATE POLICY "Vendors can delete own logo"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vendor-logos' AND auth.uid()::text = (storage.foldername(name))[1]);