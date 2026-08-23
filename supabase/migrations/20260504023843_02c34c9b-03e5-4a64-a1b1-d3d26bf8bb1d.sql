
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
    CASE WHEN NEW.raw_user_meta_data ->> 'role' = 'vendor' THEN 'vendor' ELSE 'customer' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Backfill: any profile that owns a vendor row should have role='vendor'.
ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles p
SET role = 'vendor'
WHERE role <> 'vendor'
  AND EXISTS (SELECT 1 FROM public.vendors v WHERE v.owner_id = p.id);
ALTER TABLE public.profiles ENABLE TRIGGER USER;
