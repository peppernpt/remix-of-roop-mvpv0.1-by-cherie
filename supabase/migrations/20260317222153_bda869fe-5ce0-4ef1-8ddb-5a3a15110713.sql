-- Enable RLS on all ROOP tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;

-- Allow ALL SELECT
CREATE POLICY "Allow all select on profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow all select on customer_addresses" ON customer_addresses FOR SELECT USING (true);
CREATE POLICY "Allow all select on customer_verifications" ON customer_verifications FOR SELECT USING (true);
CREATE POLICY "Allow all select on vendors" ON vendors FOR SELECT USING (true);
CREATE POLICY "Allow all select on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow all select on product_images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Allow all select on product_units" ON product_units FOR SELECT USING (true);
CREATE POLICY "Allow all select on bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Allow all select on booking_items" ON booking_items FOR SELECT USING (true);

-- Allow ALL INSERT
CREATE POLICY "Allow all insert on profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on customer_addresses" ON customer_addresses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on customer_verifications" ON customer_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on vendors" ON vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on product_images" ON product_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on product_units" ON product_units FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all insert on booking_items" ON booking_items FOR INSERT WITH CHECK (true);

-- Allow ALL UPDATE
CREATE POLICY "Allow all update on profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Allow all update on customer_addresses" ON customer_addresses FOR UPDATE USING (true);
CREATE POLICY "Allow all update on customer_verifications" ON customer_verifications FOR UPDATE USING (true);
CREATE POLICY "Allow all update on vendors" ON vendors FOR UPDATE USING (true);
CREATE POLICY "Allow all update on products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow all update on product_images" ON product_images FOR UPDATE USING (true);
CREATE POLICY "Allow all update on product_units" ON product_units FOR UPDATE USING (true);
CREATE POLICY "Allow all update on bookings" ON bookings FOR UPDATE USING (true);
CREATE POLICY "Allow all update on booking_items" ON booking_items FOR UPDATE USING (true);

-- Allow ALL DELETE
CREATE POLICY "Allow all delete on profiles" ON profiles FOR DELETE USING (true);
CREATE POLICY "Allow all delete on customer_addresses" ON customer_addresses FOR DELETE USING (true);
CREATE POLICY "Allow all delete on customer_verifications" ON customer_verifications FOR DELETE USING (true);
CREATE POLICY "Allow all delete on vendors" ON vendors FOR DELETE USING (true);
CREATE POLICY "Allow all delete on products" ON products FOR DELETE USING (true);
CREATE POLICY "Allow all delete on product_images" ON product_images FOR DELETE USING (true);
CREATE POLICY "Allow all delete on product_units" ON product_units FOR DELETE USING (true);
CREATE POLICY "Allow all delete on bookings" ON bookings FOR DELETE USING (true);
CREATE POLICY "Allow all delete on booking_items" ON booking_items FOR DELETE USING (true);