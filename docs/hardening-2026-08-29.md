# ROOP hardening & fix wave — 29 Aug 2026

This change set resolves the critical/high findings from the full codebase audit
(double-booking races, booking-status forgery, public payment slips, broken
signup paths, booking-math bugs) plus a UX pass. It has two halves:

1. **Client code** (this repo) — works against the current database immediately.
2. **One SQL migration** — [supabase/migrations/20260829000000_roop_hardening_v1.sql](../supabase/migrations/20260829000000_roop_hardening_v1.sql)
   — moves the money rules into Postgres. **The app runs fine before it is
   applied, but the security guarantees only exist after.**

## Applying the migration

Pick one:

- **Supabase Dashboard** → SQL Editor → paste the migration file → Run.
- **Supabase CLI**: `supabase db push` (project must be linked).
- **Lovable**: push this repo; approve the migration when Lovable applies it.

The migration is idempotent-ish (guarded `DO` blocks) and does not rewrite
existing data. After applying, regenerate types when convenient:
`supabase gen types typescript --project-id pvadpahhmlrodrwddjcy > src/integrations/supabase/types.ts`.

## What the migration enforces

| Rule | Before | After |
|---|---|---|
| Double-booking | Client JS only | Advisory-locked overlap check on approval + item assignment, buffer-aware (`booking_blocked_range`) |
| Booking status | Any owner could write any value | Per-role transition graph (`trg_aa_bookings_guard`) |
| Customer edits | Any column | Only slip upload + pending-cancel; money/date columns frozen |
| New bookings | Any initial status (e.g. `'paid'`) | Forced `pending_vendor_review`, payment fields nulled |
| Delivery fee / discount | Editable forever | Locked once payment submitted |
| Payment slips | Public bucket (world-readable) | Private; signed URLs (already used by the app) |
| booking_items | Unit/product/vendor unchecked | Unit must belong to product; product to booking's vendor; unique unit per booking |
| Vendor role | Self-assigned via signup metadata | Granted only by `create_vendor_store()` RPC |
| Deposit refunds | Nowhere to record | `deposit_refund_amount/-ed_at/-note` + vendor UI |
| Identity verification | Self-writable | Platform-only |
| Realtime | None | `bookings` in `supabase_realtime` publication (live app updates) |

## Client changes (highlights)

- **Availability is two-sided**: a candidate booking's own ship-out/return/
  cleaning days now count in overlap checks (calendar, bag re-check, vendor
  approval). Approval also reads `delivery_province` (EMS buffers were 1 day
  short outside Bangkok). Regression tests in `src/lib/availability.test.ts` (G–J).
- **Compare-and-swap status writes** everywhere (`.eq("status", from)`) — stale
  tabs can't resurrect cancelled orders.
- **Reject ≠ cancel**: rejection now writes `rejected` (History tab works), and
  vendors can cancel paid/to-deliver orders with a reason (stored in notes).
- **Signup dead-ends closed**: `/vendor/setup` (authenticated store creation,
  prefilled from the signup stash), pending customer profile applied after
  email confirmation, duplicate-email signups detected, password reset at
  `/auth/reset`.
- **Payments UX**: payment page shows the store's transfer details with a copy
  button (RPC `get_payment_destination` after migration), validates slip files
  (type/size), reuses one storage path per booking (no orphaned slips).
- **Vendor safety**: unit dialog no longer skips the slip / inspection
  safeguards; editing a product no longer republishes an archived one;
  delivery fee of 0 supported (free delivery / self-pickup); fee auto-saves on
  approve; deposit settlement panel at return review.
- **App shell**: error boundary, route-level code splitting (initial JS
  1.17 MB → ~272 KB), scroll-to-top on navigation, fixed mobile bottom nav,
  customer status timeline, `for_review` orders visible to customers,
  realtime + fixed refetch-listener leak, 78-province list, Thai font fallback
  (Noto Sans Thai).
- **Quality**: test suite green (131 tests; Node 25 webstorage shim in
  `src/test/setup.ts`), `tsc --noEmit` clean, `npm run typecheck` / `npm run
  check` scripts added, money-path patches fully typed.

## Still open (by design, for later phases)

- Notifications (LINE Messaging API / email via Edge Function) — realtime
  in-app updates are in; push channels need an Edge Function deploy.
- CI pipeline, e2e smoke tests, pgTAP/RLS tests.
- Thai i18n, PDPA documents, image resize pipeline, react-query adoption,
  payment deadline auto-expiry, admin role / payments table.
