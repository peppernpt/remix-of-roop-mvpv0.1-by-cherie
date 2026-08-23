ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS instagram text;
GRANT SELECT (instagram), INSERT (instagram), UPDATE (instagram) ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;