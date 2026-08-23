
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.vendor_owner_has_booking_with_customer(_owner uuid, _customer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.vendors v ON v.id = b.vendor_id
    WHERE v.owner_id = _owner AND b.customer_id = _customer
  );
$$;

CREATE OR REPLACE FUNCTION private.customer_has_booking_with_vendor(_customer uuid, _vendor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.bookings b WHERE b.customer_id = _customer AND b.vendor_id = _vendor);
$$;

CREATE OR REPLACE FUNCTION private.is_vendor_owner(_user uuid, _vendor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = _vendor AND v.owner_id = _user);
$$;

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  cmd_clause text;
  roles_clause text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual,'') ~ '(^|[^.a-zA-Z0-9_])(vendor_owner_has_booking_with_customer|customer_has_booking_with_vendor|is_vendor_owner)\('
        OR coalesce(with_check,'') ~ '(^|[^.a-zA-Z0-9_])(vendor_owner_has_booking_with_customer|customer_has_booking_with_vendor|is_vendor_owner)\('
      )
  LOOP
    new_qual := coalesce(r.qual,'');
    new_check := coalesce(r.with_check,'');
    new_qual := replace(new_qual, 'public.vendor_owner_has_booking_with_customer', 'vendor_owner_has_booking_with_customer');
    new_qual := replace(new_qual, 'public.customer_has_booking_with_vendor', 'customer_has_booking_with_vendor');
    new_qual := replace(new_qual, 'public.is_vendor_owner', 'is_vendor_owner');
    new_check := replace(new_check, 'public.vendor_owner_has_booking_with_customer', 'vendor_owner_has_booking_with_customer');
    new_check := replace(new_check, 'public.customer_has_booking_with_vendor', 'customer_has_booking_with_vendor');
    new_check := replace(new_check, 'public.is_vendor_owner', 'is_vendor_owner');
    new_qual := regexp_replace(new_qual, '(^|[^.a-zA-Z0-9_])(vendor_owner_has_booking_with_customer|customer_has_booking_with_vendor|is_vendor_owner)\(', '\1private.\2(', 'g');
    new_check := regexp_replace(new_check, '(^|[^.a-zA-Z0-9_])(vendor_owner_has_booking_with_customer|customer_has_booking_with_vendor|is_vendor_owner)\(', '\1private.\2(', 'g');

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    cmd_clause := CASE r.cmd
      WHEN 'SELECT' THEN 'FOR SELECT' WHEN 'INSERT' THEN 'FOR INSERT'
      WHEN 'UPDATE' THEN 'FOR UPDATE' WHEN 'DELETE' THEN 'FOR DELETE'
      ELSE 'FOR ALL' END;
    roles_clause := CASE WHEN r.roles IS NULL OR array_length(r.roles,1) IS NULL
      THEN 'TO public' ELSE 'TO ' || array_to_string(r.roles, ', ') END;

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s %s %s %s %s',
      r.policyname, r.schemaname, r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_clause, roles_clause,
      CASE WHEN r.qual IS NOT NULL THEN 'USING (' || new_qual || ')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.vendor_owner_has_booking_with_customer(uuid, uuid);
DROP FUNCTION IF EXISTS public.customer_has_booking_with_vendor(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_vendor_owner(uuid, uuid);
