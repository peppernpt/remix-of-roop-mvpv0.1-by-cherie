# Standardize rental dates: "Last Rental Date" policy

The second date a customer picks now means the **last rental date** (final day they keep the item), not the return date. The actual return is always the next calendar day. Day counting stays the same math (difference, not inclusive), so pricing for a given pair of dates does not change — but every label, timeline and blocked-date calculation shifts to the new meaning.

## Policy

```text
rental_start        = first rental day (selected)
last_rental_date    = final rental day (selected, stored in rental_end)
actual_return_date  = last_rental_date + 1 day
rental_days         = last_rental_date - rental_start   (no +1)
cleaning/buffer     = starts after actual_return_date
blocked dates       = rental_start .. last_rental_date, actual_return_date, buffer days
```

Example: 17 Aug → 19 Aug = 2 rental days, return 20 Aug, cleaning 21 Aug, next free 22 Aug.

The database column `rental_end` keeps storing the selected last rental date. No data migration; old test bookings simply read one day shorter on the buffer side.

## Shared helpers (src/lib/date-utils.ts + src/lib/booking-logic.ts)

Add and use everywhere instead of one-off date math:

- `getRentalDays(start, lastRentalDate)` — calendar difference (existing `calculateRentalDays` / `rentalDays` already do this; keep as the single source and re-export under the new name).
- `getActualReturnDate(lastRentalDate)` — `+1 day`.
- `getCleaningRange(actualReturnDate, bufferDays)`.
- `getBlockedDateRange(start, lastRentalDate, bufferDays)`.

Rework `computeLifecycle` in `booking-logic.ts`:

- rename the concept `customerReturn` to `actualReturn = lastRentalDate + 1`; drop `wearEnd` (the whole selected range is now wear time).
- Messenger: cleaning = actualReturn + 1; available again = actualReturn + 2.
- EMS: keep the existing offsets but base `storeReceive` on `actualReturn` instead of the selected end date; `shipOut` logic unchanged.
- `lifecycleBlockedDates` blocks start..lastRentalDate plus actualReturn, storeReceive and cleaning days.

`src/lib/availability.ts` keeps its blocking-status list unchanged; its fallback `BUFFER_DAYS_AFTER` becomes actual-return + cleaning so both paths agree. Approval checks (`approval-availability.ts`) and cancellation release (`cancellation.ts`) inherit this automatically since they call the shared helpers.

## UI updates

Customer booking page (`src/pages/Booking.tsx`)
- "Return date" label → "Last rental date"; keep the rule that the last rental date must be after the start date (min 1 rental day).
- Timeline rows become: **Rental period** `17 Aug → 19 Aug`, **Return by 12 PM** `20 Aug`, **Cleaning** `21 Aug`, **Available again**. Remove the "you wear it …" copy.
- Duration text: "2 days rental".

Customer bag (`Bag.tsx`), tracking (`Tracking.tsx`), home, history, payment slip, order detail modal
- Show "Rental period: 17 Aug 2026 → 19 Aug 2026" and "N days rental".
- Any return wording uses `getActualReturnDate` (Tracking already adds +1; it will now use the helper).
- `CustomerOrderDetailDialog` row "Return date" → "Last rental date", plus a separate "Actual return date" row.

Vendor side
- `OrderDetailDialog` shows Start Date / Last Rental Date / Actual Return Date / Days.
- Transactions and History tables keep showing the selected period `17 Aug – 19 Aug`; `UnitDetailDialog` and `ProductUnitsDialog` labels follow the same wording.

## Pricing

No formula change: subtotal uses the same `rental_days` (difference). `pricing.ts` custom-duration lookup keeps matching the exact day count (2 rental days → 2-day custom price), deposit once per booking, delivery fee and promo code untouched.

## Tests

Update/extend `booking-logic.test.ts`, `date-utils.test.ts`, `availability.test.ts`, `approval-availability.test.ts`, `pricing.test.ts` for:
- A: 17→18 = 1 day, return 19, ฿290.
- B: 17→19 = 2 days, return 20, ฿580.
- C: custom rates 1/2/3 day → 17→19 uses the 2-day price.
- D: blocked set = 17,18,19,20,21; 22 Aug selectable.
- G: cancelled/rejected booking releases the same range.
