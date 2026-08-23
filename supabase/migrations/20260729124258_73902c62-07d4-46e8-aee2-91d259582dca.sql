-- Grant read access to columns added after the original column-level grants.
GRANT SELECT (
  subdistrict, store_category, store_address, postal_code, tax_id, line_id
) ON public.vendors TO authenticated;

-- Catalogue cards display subdistrict/line-id-free public info for guests.
GRANT SELECT (subdistrict) ON public.vendors TO anon;

-- Vendor owners must be able to edit their own store profile fields.
GRANT INSERT, DELETE ON public.vendors TO authenticated;
GRANT UPDATE (
  store_name, description, logo_url, city, state, is_active, deposit_per_item,
  bank_account, email, phone, subdistrict, store_category, store_address,
  postal_code, tax_id, line_id, updated_at
) ON public.vendors TO authenticated;

GRANT ALL ON public.vendors TO service_role;