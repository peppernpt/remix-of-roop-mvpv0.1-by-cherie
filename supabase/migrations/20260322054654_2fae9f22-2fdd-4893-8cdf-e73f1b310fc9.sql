
-- VENDORS: Replace open write policies with owner-scoped
DROP POLICY "Allow all insert on vendors" ON vendors;
DROP POLICY "Allow all update on vendors" ON vendors;
DROP POLICY "Allow all delete on vendors" ON vendors;

CREATE POLICY "Vendor owner can insert" ON vendors FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Vendor owner can update" ON vendors FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Vendor owner can delete" ON vendors FOR DELETE TO authenticated USING (auth.uid() = owner_id);
