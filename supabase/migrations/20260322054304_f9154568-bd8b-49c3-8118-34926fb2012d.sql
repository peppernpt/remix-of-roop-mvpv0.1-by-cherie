
-- BOOKINGS: Replace open policies with user-scoped
DROP POLICY "Allow all select on bookings" ON bookings;
DROP POLICY "Allow all insert on bookings" ON bookings;
DROP POLICY "Allow all update on bookings" ON bookings;
DROP POLICY "Allow all delete on bookings" ON bookings;

CREATE POLICY "Users can select own bookings" ON bookings FOR SELECT TO authenticated USING (auth.uid() = customer_id OR auth.uid() = vendor_id);
CREATE POLICY "Users can insert own bookings" ON bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE TO authenticated USING (auth.uid() = customer_id OR auth.uid() = vendor_id);

-- BOOKING_ITEMS: Replace open policies with user-scoped via join
DROP POLICY "Allow all select on booking_items" ON booking_items;
DROP POLICY "Allow all insert on booking_items" ON booking_items;
DROP POLICY "Allow all update on booking_items" ON booking_items;
DROP POLICY "Allow all delete on booking_items" ON booking_items;

CREATE POLICY "Users can select own booking items" ON booking_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_items.booking_id AND (bookings.customer_id = auth.uid() OR bookings.vendor_id = auth.uid())));
CREATE POLICY "Users can insert own booking items" ON booking_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_items.booking_id AND bookings.customer_id = auth.uid()));

-- CUSTOMER_ADDRESSES: Replace open policies with user-scoped
DROP POLICY "Allow all select on customer_addresses" ON customer_addresses;
DROP POLICY "Allow all insert on customer_addresses" ON customer_addresses;
DROP POLICY "Allow all update on customer_addresses" ON customer_addresses;
DROP POLICY "Allow all delete on customer_addresses" ON customer_addresses;

CREATE POLICY "Users can select own addresses" ON customer_addresses FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Users can insert own addresses" ON customer_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Users can update own addresses" ON customer_addresses FOR UPDATE TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Users can delete own addresses" ON customer_addresses FOR DELETE TO authenticated USING (auth.uid() = customer_id);
