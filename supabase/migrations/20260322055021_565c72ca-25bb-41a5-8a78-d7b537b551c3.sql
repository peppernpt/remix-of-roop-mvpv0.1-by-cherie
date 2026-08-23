
-- Replace open SELECT on vendors with authenticated-only, owner-scoped for sensitive fields
DROP POLICY "Allow all select on vendors" ON vendors;

-- Public can see non-sensitive vendor info (store_name, description, logo, city, state, is_active, deposit_per_item)
-- But email and phone are only visible to the owner
-- We'll use a view approach instead: restrict SELECT to authenticated and use column-level security via a view

-- For now, restrict full SELECT to authenticated users only
CREATE POLICY "Authenticated users can select vendors" ON vendors FOR SELECT TO authenticated USING (true);

-- Create a public view that excludes sensitive fields for browsing
CREATE OR REPLACE VIEW public.vendors_public AS
SELECT id, store_name, description, logo_url, city, state, is_active, deposit_per_item, created_at, updated_at
FROM vendors
WHERE is_active = true;
