# Return responsibility acknowledgement

Customers must see where to return the item, understand that return shipping is paid by them, and tick a required acknowledgement before sending a rental request.

## 1. Shared return-address helper

New `src/lib/return-address.ts`:
- `formatReturnAddress({ store_name, store_address, subdistrict, city, postal_code })` → clean single line, e.g. `RentCHOM — Thonglor 123, Wattana, Bangkok, 10110`.
- Returns `null` when no address parts exist, so UI can show:
  - "Store return address not added yet."
  - "Please confirm the return address with the store via LINE before payment."
- Never uses the customer's registered address.
- Unit tests for full, partial, and missing addresses.

## 2. Bag page (`src/pages/customer/Bag.tsx`)

- Fetch the vendor's public store fields for the bag item's vendor.
- New "Return responsibility" section above the submit button:
  - "You are responsible for sending the item back to the store by the return date."
  - Return address block (or missing-address fallback).
  - Note: "The total shown here does not include the return delivery fee. You will need to pay the return delivery fee separately when sending the item back to the store."
- New required checkbox: "I understand that I am responsible for returning the item to the store, and that the return delivery fee is not included in the total shown here."
- "Send order request" stays disabled until both the existing request-policy checkbox and this new one are ticked (submit also guards it).
- Payment summary note updated to include: "Total shown does not include the return delivery fee. Customers are responsible for return shipping."
- No change to totals, promo, deposit, delivery fee, date logic, availability, or the one-item rule.

## 3. Saved acknowledgement

Database migration (additive only, no changes to existing columns/policies):
- `bookings.return_policy_acknowledged boolean not null default false`
- `bookings.return_policy_acknowledged_at timestamptz`
- `bookings.return_address_snapshot text`

Bag submit writes all three at insert time (snapshot = formatted address at booking time, or null when missing).

The `vendors_public` view currently exposes only `store_name`, `city`, `state` — it will be recreated to also expose `store_address`, `subdistrict`, `postal_code` (business address, not personal PII; contact email/phone stay hidden).

## 4. Order Request Sent page

Add a compact "Return reminder" card: "When your rental ends, send the item back to the store using the return address shown in Tracking. Return delivery cost is paid separately by you."

## 5. Tracking page

`useCustomerBookings` also returns the vendor return address and `return_address_snapshot`.
On active rental cards (and the customer order detail modal) with status `on_rent` / `on_return`, show a "Return instructions" block:
- Return by: actual return date (existing helper, no date-logic change)
- Return address: vendor return address (snapshot first, else current store profile, else missing-address fallback)
- Return delivery fee: Paid separately by customer

For `on_return`, highlight: "Please send the item back to the store by today and share the return tracking details with the store via LINE."

## 6. Vendor order detail modal

One small line in the existing details area:
- "Customer acknowledged return responsibility." plus "Acknowledged on <date/time>" when the timestamp exists.

## 7. Copy consistency

Use only: Return delivery fee, Return address, Return responsibility, Paid separately by customer.

## Verification

- Vitest: new return-address tests plus existing suite.
- Browser pass: bag with one item shows the section and address, submit disabled until both boxes are ticked, submit succeeds, tracking shows return instructions; totals unchanged.
