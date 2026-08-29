-- ============================================================================
-- ROOP HARDENING MIGRATION (2026-08-29)
--
-- Moves the money-path rules from browser JavaScript into the database:
--   1.  payment-slips storage bucket -> private (slips were world-readable)
--   2.  Booking INSERT: forced initial status, no forged payment fields,
--       sane dates
--   3.  Booking UPDATE guard: per-role column whitelist + status state machine
--       (customers can no longer mark themselves paid / change dates / zero
--       fees; stale tabs can no longer resurrect cancelled bookings)
--   4.  Double-booking protection: advisory-locked, buffer-aware overlap
--       checks that fire when a booking enters a blocking status and when
--       items are (re)assigned to units
--   5.  booking_items integrity: unit must belong to the item's product,
--       product must belong to the booking's vendor, one unit per booking
--   6.  CHECK constraints: date ordering + non-negative money
--   7.  Deposit settlement columns (refund amount / time / note)
--   8.  Vendor onboarding: signup metadata can no longer self-assign the
--       vendor role; stores are created via create_vendor_store()
--   9.  get_payment_destination(): customers see where to transfer money
--  10.  customer_verifications: customers cannot verify themselves
--  11.  Realtime publication for bookings (live status updates in the app)
--  12.  Indexes on the hot foreign keys / RLS paths
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Payment slips: private bucket. The app already renders slips through
--    short-lived signed URLs, so this is a drop-in change.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'payment-slips';

-- ---------------------------------------------------------------------------
-- 7. Deposit settlement columns (added early so later functions can reference)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_refund_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_refund_note text;

-- ---------------------------------------------------------------------------
-- 6. Basic sanity constraints
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_dates_ordered CHECK (rental_end >= rental_start);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_money_non_negative CHECK (
      coalesce(rental_total, 0) >= 0
      AND coalesce(deposit_total, 0) >= 0
      AND coalesce(delivery_fee, 0) >= 0
      AND coalesce(grand_total, 0) >= 0
      AND (discounted_rental_total IS NULL OR discounted_rental_total >= 0)
      AND (deposit_refund_amount IS NULL OR deposit_refund_amount >= 0)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4a. Buffer-aware blocked range, mirroring src/lib/booking-logic.ts exactly:
--   Messenger:            [start,            end + 2]  (return day + cleaning)
--   EMS  (Bangkok):       [start - 2,        end + 3]  (ship-out .. cleaning)
--   EMS  (elsewhere):     [start - 3,        end + 4]
--   Unknown method:       Messenger fallback
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_blocked_range(
  _start date, _end date, _method text, _province text
) RETURNS daterange
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(_method, '')) = 'ems'
         AND lower(trim(coalesce(nullif(trim(_province), ''), 'Bangkok'))) = 'bangkok'
      THEN daterange(_start - 2, _end + 3, '[]')
    WHEN lower(coalesce(_method, '')) = 'ems'
      THEN daterange(_start - 3, _end + 4, '[]')
    ELSE daterange(_start, _end + 2, '[]')
  END
$$;

-- Statuses that block a unit's calendar (matches src/lib/availability.ts,
-- including the legacy 'payment_confirmed' value still present in old rows).
CREATE OR REPLACE FUNCTION public.is_blocking_booking_status(_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT _status = ANY (ARRAY[
    'approved_waiting_payment','payment_submitted','paid','payment_confirmed',
    'to_deliver','on_delivery','on_rent','on_return','for_review'
  ])
$$;

-- ---------------------------------------------------------------------------
-- 4b. Core overlap assertion. Locks each unit (advisory, transaction-scoped)
--     so two concurrent approvals of overlapping requests serialize, then
--     rejects any buffered-range overlap with another blocking booking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_booking_units_available(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b RECORD;
  unit uuid;
  conflict_id uuid;
BEGIN
  SELECT id, rental_start, rental_end, delivery_method, delivery_province
    INTO b FROM public.bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR unit IN
    SELECT bi.product_unit_id FROM public.booking_items bi
    WHERE bi.booking_id = _booking_id AND bi.product_unit_id IS NOT NULL
    ORDER BY bi.product_unit_id     -- stable order avoids lock inversion
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(unit::text, 74));
    SELECT bi2.booking_id INTO conflict_id
      FROM public.booking_items bi2
      JOIN public.bookings b2 ON b2.id = bi2.booking_id
     WHERE bi2.product_unit_id = unit
       AND bi2.booking_id <> _booking_id
       AND public.is_blocking_booking_status(b2.status)
       AND public.booking_blocked_range(b.rental_start, b.rental_end, b.delivery_method, b.delivery_province)
           && public.booking_blocked_range(b2.rental_start, b2.rental_end, b2.delivery_method, b2.delivery_province)
     LIMIT 1;
    IF conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'This item is no longer available for the selected dates (unit % overlaps booking %).', unit, conflict_id
        USING ERRCODE = 'P0001', HINT = 'UNIT_UNAVAILABLE';
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. booking_items integrity + overlap guard for already-blocking bookings
-- ---------------------------------------------------------------------------

-- One physical unit at most once per booking.
DO $$ BEGIN
  ALTER TABLE public.booking_items
    ADD CONSTRAINT booking_items_unique_unit_per_booking UNIQUE (booking_id, product_unit_id);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN unique_violation THEN RAISE NOTICE 'duplicate booking_items rows exist; constraint skipped'; END $$;

CREATE OR REPLACE FUNCTION public.trg_booking_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bk RECORD;
  unit_product uuid;
  item_vendor uuid;
BEGIN
  SELECT id, vendor_id, status INTO bk FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', NEW.booking_id;
  END IF;

  -- The unit must be a unit OF the item''s product (blocks the cheap-product /
  -- expensive-unit price manipulation and keeps availability queries honest).
  IF NEW.product_unit_id IS NOT NULL THEN
    SELECT product_id INTO unit_product FROM public.product_units WHERE id = NEW.product_unit_id;
    IF unit_product IS NULL OR unit_product <> NEW.product_id THEN
      RAISE EXCEPTION 'Unit % does not belong to product %', NEW.product_unit_id, NEW.product_id;
    END IF;
  END IF;

  -- The product must belong to the booking''s vendor.
  SELECT vendor_id INTO item_vendor FROM public.products WHERE id = NEW.product_id;
  IF item_vendor IS NULL OR item_vendor <> bk.vendor_id THEN
    RAISE EXCEPTION 'Product % does not belong to the booking''s vendor', NEW.product_id;
  END IF;

  -- If the parent booking already blocks the calendar (e.g. unit reassignment
  -- during approval), the newly assigned unit must be conflict-free.
  IF NEW.product_unit_id IS NOT NULL AND public.is_blocking_booking_status(bk.status) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.product_unit_id::text, 74));
    PERFORM 1
      FROM public.booking_items bi2
      JOIN public.bookings b2 ON b2.id = bi2.booking_id
      JOIN public.bookings b1 ON b1.id = NEW.booking_id
     WHERE bi2.product_unit_id = NEW.product_unit_id
       AND bi2.booking_id <> NEW.booking_id
       AND public.is_blocking_booking_status(b2.status)
       AND public.booking_blocked_range(b1.rental_start, b1.rental_end, b1.delivery_method, b1.delivery_province)
           && public.booking_blocked_range(b2.rental_start, b2.rental_end, b2.delivery_method, b2.delivery_province)
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'This item is no longer available for the selected dates.'
        USING ERRCODE = 'P0001', HINT = 'UNIT_UNAVAILABLE';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_aa_booking_items_guard ON public.booking_items;
CREATE TRIGGER trg_aa_booking_items_guard
  BEFORE INSERT OR UPDATE OF product_unit_id, product_id, booking_id ON public.booking_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_booking_items_guard();

-- ---------------------------------------------------------------------------
-- 2. Booking INSERT: extend the existing defaults trigger function so every
--    new booking starts life as a pending request with no payment state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_totals_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    -- Money: zeroed; the items trigger fills totals from server-side prices.
    NEW.rental_total := 0;
    NEW.deposit_total := 0;
    NEW.delivery_fee := 0;                -- the vendor sets it at approval
    NEW.discounted_rental_total := NULL;
    NEW.grand_total := 0;
    -- Lifecycle: no booking is born approved, paid or delivered.
    NEW.status := 'pending_vendor_review';
    NEW.payment_slip_url := NULL;
    NEW.payment_submitted_at := NULL;
    NEW.payment_confirmed_at := NULL;
    NEW.delivery_tracking_url := NULL;
    NEW.deposit_refund_amount := NULL;
    NEW.deposit_refunded_at := NULL;
    NEW.deposit_refund_note := NULL;
    -- Dates: today or later (UTC date is never ahead of Bangkok's).
    IF NEW.rental_start < current_date THEN
      RAISE EXCEPTION 'Rental cannot start in the past';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Booking UPDATE guard: state machine + per-role column whitelist.
--    Named trg_aa_* so it runs before the totals-recompute trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_booking_transition(
  _from text, _to text, _actor text
) RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _actor
    WHEN 'customer' THEN
      (_from = 'pending_vendor_review'    AND _to = 'cancelled') OR
      (_from = 'approved_waiting_payment' AND _to = 'payment_submitted') OR
      (_from = 'payment_submitted'        AND _to = 'payment_submitted')
    WHEN 'vendor' THEN
      (_from = 'pending_vendor_review'    AND _to IN ('approved_waiting_payment','rejected','cancelled')) OR
      (_from = 'approved_waiting_payment' AND _to IN ('cancelled')) OR
      (_from = 'payment_submitted'        AND _to IN ('to_deliver','approved_waiting_payment')) OR
      (_from = 'paid'                     AND _to IN ('to_deliver','cancelled')) OR
      (_from = 'payment_confirmed'        AND _to IN ('to_deliver','cancelled')) OR  -- legacy rows
      (_from = 'to_deliver'               AND _to IN ('on_delivery','cancelled')) OR
      (_from = 'on_delivery'              AND _to IN ('on_rent','to_deliver')) OR
      (_from = 'on_rent'                  AND _to IN ('on_return','on_delivery')) OR
      (_from = 'on_return'                AND _to IN ('for_review','on_rent')) OR
      (_from = 'for_review'               AND _to IN ('completed','on_return')) OR
      (_from = 'completed'                AND _to IN ('on_return'))               -- inspection rollback
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.trg_bookings_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor text;
  uid uuid;
BEGIN
  -- Updates issued by other triggers (e.g. the items totals recompute) and by
  -- service-role / SQL maintenance are trusted server-side paths.
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  uid := auth.uid();
  IF uid IS NULL THEN RETURN NEW; END IF;

  IF uid = OLD.customer_id AND NOT private.is_vendor_owner(uid, OLD.vendor_id) THEN
    actor := 'customer';
  ELSIF private.is_vendor_owner(uid, OLD.vendor_id) THEN
    actor := 'vendor';
  ELSE
    RAISE EXCEPTION 'Not allowed to modify this booking';
  END IF;

  -- Identity and rental window are immutable through the API. Date changes
  -- would silently invalidate the price and the availability check that
  -- approved this booking.
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
     OR NEW.rental_start IS DISTINCT FROM OLD.rental_start
     OR NEW.rental_end IS DISTINCT FROM OLD.rental_end
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Booking identity and rental dates cannot be changed';
  END IF;

  -- Server-derived totals are never client-writable directly.
  IF NEW.rental_total IS DISTINCT FROM OLD.rental_total
     OR NEW.deposit_total IS DISTINCT FROM OLD.deposit_total THEN
    RAISE EXCEPTION 'Booking totals are derived from booking items';
  END IF;

  -- Status transitions per actor.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.is_valid_booking_transition(OLD.status, NEW.status, actor) THEN
      RAISE EXCEPTION 'Transition % -> % is not allowed for %', OLD.status, NEW.status, actor;
    END IF;
    -- Payment can only be submitted with a slip attached.
    IF actor = 'customer' AND NEW.status = 'payment_submitted'
       AND (NEW.payment_slip_url IS NULL OR length(trim(NEW.payment_slip_url)) = 0) THEN
      RAISE EXCEPTION 'A payment slip is required to submit payment';
    END IF;
    -- Entering a calendar-blocking status re-validates availability atomically.
    IF public.is_blocking_booking_status(NEW.status)
       AND NOT public.is_blocking_booking_status(OLD.status) THEN
      PERFORM public.assert_booking_units_available(NEW.id);
    END IF;
  END IF;

  IF actor = 'customer' THEN
    -- Everything outside this whitelist is frozen for customers.
    IF NEW.delivery_fee            IS DISTINCT FROM OLD.delivery_fee
       OR NEW.discounted_rental_total IS DISTINCT FROM OLD.discounted_rental_total
       OR NEW.grand_total          IS DISTINCT FROM OLD.grand_total
       OR NEW.payment_confirmed_at IS DISTINCT FROM OLD.payment_confirmed_at
       OR NEW.delivery_tracking_url IS DISTINCT FROM OLD.delivery_tracking_url
       OR NEW.deposit_refund_amount IS DISTINCT FROM OLD.deposit_refund_amount
       OR NEW.deposit_refunded_at  IS DISTINCT FROM OLD.deposit_refunded_at
       OR NEW.deposit_refund_note  IS DISTINCT FROM OLD.deposit_refund_note
       OR NEW.notes                IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'This field can only be changed by the store';
    END IF;
  ELSE
    -- Vendor: money quoted to the customer freezes once payment is submitted.
    IF (NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
        OR NEW.discounted_rental_total IS DISTINCT FROM OLD.discounted_rental_total)
       AND OLD.status NOT IN ('pending_vendor_review', 'approved_waiting_payment') THEN
      RAISE EXCEPTION 'Delivery fee and discount are locked after the customer submits payment';
    END IF;
    -- Deposit settlement only after the return has come back.
    IF (NEW.deposit_refund_amount IS DISTINCT FROM OLD.deposit_refund_amount
        OR NEW.deposit_refunded_at IS DISTINCT FROM OLD.deposit_refunded_at)
       AND OLD.status NOT IN ('for_review', 'completed') THEN
      RAISE EXCEPTION 'Deposit refunds are recorded after return inspection';
    END IF;
    IF NEW.deposit_refund_amount IS NOT NULL
       AND NEW.deposit_refund_amount > coalesce(OLD.deposit_total, 0) THEN
      RAISE EXCEPTION 'Deposit refund cannot exceed the deposit collected';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_aa_bookings_guard ON public.bookings;
CREATE TRIGGER trg_aa_bookings_guard
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_bookings_guard();

-- ---------------------------------------------------------------------------
-- 8. Vendor onboarding: role comes from owning a store, not from signup
--    metadata. create_vendor_store() is the single provisioning path.
-- ---------------------------------------------------------------------------

-- 8a. Signup metadata can no longer mint vendors.
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
    'customer'  -- vendor capability is granted by create_vendor_store() only
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 8b. Role changes stay blocked for users, but the provisioning RPC may set a
--     transaction-local flag to promote.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND coalesce(current_setting('roop.allow_role_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Changing the role field is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

-- 8c. One store per account.
DO $$ BEGIN
  ALTER TABLE public.vendors ADD CONSTRAINT vendors_owner_unique UNIQUE (owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN unique_violation THEN RAISE NOTICE 'duplicate vendors.owner_id rows exist; constraint skipped'; END $$;

-- 8d. The provisioning RPC: creates the store and promotes the caller in one
--     transaction. SECURITY DEFINER so it can bypass the role-change guard.
CREATE OR REPLACE FUNCTION public.create_vendor_store(_store jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  new_id uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a store';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendors WHERE owner_id = uid) THEN
    RAISE EXCEPTION 'This account already has a store';
  END IF;
  IF nullif(trim(_store->>'store_name'), '') IS NULL THEN
    RAISE EXCEPTION 'Store name is required';
  END IF;

  INSERT INTO public.vendors (
    owner_id, store_name, store_category, description, store_address,
    subdistrict, city, postal_code, line_id, instagram,
    rental_details_policy, logo_url, deposit_per_item, is_active
  ) VALUES (
    uid,
    nullif(trim(_store->>'store_name'), ''),
    nullif(trim(_store->>'store_category'), ''),
    nullif(trim(_store->>'description'), ''),
    nullif(trim(_store->>'store_address'), ''),
    nullif(trim(_store->>'subdistrict'), ''),
    nullif(trim(_store->>'city'), ''),
    nullif(trim(_store->>'postal_code'), ''),
    nullif(trim(_store->>'line_id'), ''),
    nullif(trim(_store->>'instagram'), ''),
    nullif(trim(_store->>'rental_details_policy'), ''),
    nullif(trim(_store->>'logo_url'), ''),
    coalesce((_store->>'deposit_per_item')::numeric, 0),
    coalesce((_store->>'is_active')::boolean, true)
  )
  RETURNING id INTO new_id;

  PERFORM set_config('roop.allow_role_change', 'on', true);
  UPDATE public.profiles SET role = 'vendor' WHERE id = uid;

  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.create_vendor_store(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_vendor_store(jsonb) TO authenticated;

-- 8e. Direct vendors INSERT now requires the vendor role (the RPC, running as
--     definer, is exempt). Existing vendors keep working; new stores go
--     through create_vendor_store().
DROP POLICY IF EXISTS "Vendor owner can insert" ON public.vendors;
CREATE POLICY "Vendor owner can insert"
ON public.vendors FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'vendor')
);

-- ---------------------------------------------------------------------------
-- 9. Payment destination: a customer may read the transfer details of the
--    store their booking belongs to — nothing more.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_destination(_booking_id uuid)
RETURNS TABLE (store_name text, bank_account text, line_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.store_name, v.bank_account, v.line_id
  FROM public.bookings b
  JOIN public.vendors v ON v.id = b.vendor_id
  WHERE b.id = _booking_id AND b.customer_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_payment_destination(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_destination(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Identity verification is granted by the platform, not self-served.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_customer_verifications_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- service role / admin SQL
  IF tg_op = 'INSERT' THEN
    NEW.verified := false;
    NEW.verified_at := NULL;
  ELSIF NEW.verified IS DISTINCT FROM OLD.verified
        OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'Verification status is set by ROOP, not by the account';
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'customer_verifications') THEN
    DROP TRIGGER IF EXISTS trg_customer_verifications_guard ON public.customer_verifications;
    CREATE TRIGGER trg_customer_verifications_guard
      BEFORE INSERT OR UPDATE ON public.customer_verifications
      FOR EACH ROW EXECUTE FUNCTION public.trg_customer_verifications_guard();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. Realtime: booking changes push to the app (approvals, payments, new
--     requests) instead of waiting for a tab refocus.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication not found; skipped';
END $$;

-- ---------------------------------------------------------------------------
-- 12. Indexes for the hot paths (RLS checks, dashboards, availability).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vendor ON public.bookings (vendor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking ON public.booking_items (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_unit ON public.booking_items (product_unit_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_product ON public.booking_items (product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units (product_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON public.customer_addresses (customer_id);
CREATE INDEX IF NOT EXISTS idx_vendors_owner ON public.vendors (owner_id);
