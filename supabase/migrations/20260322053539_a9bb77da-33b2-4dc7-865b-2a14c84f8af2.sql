
-- PROFILES: Drop existing permissive policies
DROP POLICY "Allow all select on profiles" ON profiles;
DROP POLICY "Allow all insert on profiles" ON profiles;
DROP POLICY "Allow all update on profiles" ON profiles;
DROP POLICY "Allow all delete on profiles" ON profiles;

-- PROFILES: Create scoped policies
CREATE POLICY "Users can select own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- CUSTOMER_VERIFICATIONS: Drop existing permissive policies
DROP POLICY "Allow all select on customer_verifications" ON customer_verifications;
DROP POLICY "Allow all insert on customer_verifications" ON customer_verifications;
DROP POLICY "Allow all update on customer_verifications" ON customer_verifications;
DROP POLICY "Allow all delete on customer_verifications" ON customer_verifications;

-- CUSTOMER_VERIFICATIONS: Create scoped policies
CREATE POLICY "Users can select own verification" ON customer_verifications FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Users can insert own verification" ON customer_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
