import { parseDatabaseDate } from "./date-utils";
// ROOP — shared date-based availability logic.
//
// Pure calculation only: this module never creates or mutates bookings,
// booking_items, or product_units. It answers a single question:
// "is this unit/product free for the selected rental date range?"
//
// Core rule: availability is decided by DATE OVERLAP against existing
// blocking bookings (+ buffer), NOT by product_units.status.

import {
  addDays,
  startOfDay,
  computeLifecycle,
  lifecycleBlockedDates,
  BANGKOK,
  type DeliveryMethod,
  type Province,
} from "./booking-logic";

// ---------- Blocking statuses ----------
// Only these booking statuses remove dates from the calendar.
// pending_vendor_review does NOT block (request not accepted yet).
// completed / cancelled / rejected do NOT block future dates — a cancelled or
// rejected booking releases both its rental dates AND its cleaning buffer.
export const BLOCKING_BOOKING_STATUSES = [
  "approved_waiting_payment",
  "payment_submitted",
  "paid",
  "payment_confirmed",
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
  "for_review",
] as const;

/** Statuses that must never block a date range. */
export const NON_BLOCKING_BOOKING_STATUSES = [
  "pending_vendor_review",
  "completed",
  "cancelled",
  "rejected",
] as const;

export type BlockingStatus = (typeof BLOCKING_BOOKING_STATUSES)[number];

const BLOCKING_SET = new Set<string>(BLOCKING_BOOKING_STATUSES);

export const isBlockingStatus = (status: string | null | undefined) =>
  !!status && BLOCKING_SET.has(status);

// ---------- Buffer policy ----------
// Mirrors the existing lifecycle policy in booking-logic.ts. The stored
// rental_end is the LAST RENTAL DATE; the actual return is the next day and
// the cleaning buffer starts after that:
//   Messenger (Bangkok): return last+1, cleaning last+2 → free again last+3
//   EMS:                 ship out 2 (BKK) / 3 (outside) days before start; receive after return
// These constants are the fallback when a booking's delivery method /
// province is unknown. Adjust here if the buffer policy changes.
export const BUFFER_DAYS_BEFORE = 0; // Messenger default (EMS adds 2-3 via lifecycle)
export const BUFFER_DAYS_AFTER = 2; // actual return day + 1 cleaning day


export interface BookingLike {
  id?: string;
  status: string;
  rental_start: string | Date;
  rental_end: string | Date;
  /** Unit ids covered by this booking (from booking_items). */
  product_unit_ids?: string[];
  product_unit_id?: string | null;
  delivery_method?: string | null;
  province?: string | null;
}

export interface DateRange {
  start: Date;
  end: Date;
}

const toDate = (d: string | Date): Date => parseDatabaseDate(d);

const unitIdsOf = (b: BookingLike): string[] =>
  b.product_unit_ids?.length
    ? b.product_unit_ids
    : b.product_unit_id
      ? [b.product_unit_id]
      : [];

/**
 * Expand a booking into its blocked date range (rental range + buffers).
 * Uses the existing lifecycle policy when the delivery method is known,
 * otherwise falls back to the BUFFER_DAYS_* constants above.
 */
export function blockedRangeForBooking(
  booking: BookingLike,
  bufferDaysBefore = BUFFER_DAYS_BEFORE,
  bufferDaysAfter = BUFFER_DAYS_AFTER,
): DateRange {
  const start = toDate(booking.rental_start);
  const end = toDate(booking.rental_end);

  const method = booking.delivery_method as DeliveryMethod | null | undefined;
  if (method === "Messenger" || method === "EMS") {
    const province = (booking.province as Province) || BANGKOK;
    const dates = lifecycleBlockedDates(computeLifecycle(start, end, method, province));
    const times = dates.map((d) => startOfDay(d).getTime());
    return {
      start: new Date(Math.min(...times)),
      end: new Date(Math.max(...times)),
    };
  }

  return {
    start: addDays(start, -Math.max(0, bufferDaysBefore)),
    end: addDays(end, Math.max(0, bufferDaysAfter)),
  };
}

/** Ranges overlap if selectedStart <= blockedEnd AND selectedEnd >= blockedStart. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return (
    startOfDay(a.start).getTime() <= startOfDay(b.end).getTime() &&
    startOfDay(a.end).getTime() >= startOfDay(b.start).getTime()
  );
}

/** Blocked (buffered) ranges for one unit, from blocking-status bookings only. */
export function getBlockedDateRangesForUnit(
  unitId: string,
  existingBookings: BookingLike[],
  bufferDaysBefore = BUFFER_DAYS_BEFORE,
  bufferDaysAfter = BUFFER_DAYS_AFTER,
): DateRange[] {
  return (existingBookings ?? [])
    .filter((b) => isBlockingStatus(b.status) && unitIdsOf(b).includes(unitId))
    .map((b) => blockedRangeForBooking(b, bufferDaysBefore, bufferDaysAfter));
}

export interface UnitAvailabilityArgs {
  unitId: string;
  selectedStartDate: string | Date;
  selectedEndDate: string | Date;
  existingBookings: BookingLike[];
  bufferDaysBefore?: number;
  bufferDaysAfter?: number;
  /** Optional: ignore a booking (e.g. the one being approved/edited). */
  ignoreBookingId?: string;
}

/** true = unit is free for the selected range. */
export function isUnitAvailableForDateRange({
  unitId,
  selectedStartDate,
  selectedEndDate,
  existingBookings,
  bufferDaysBefore = BUFFER_DAYS_BEFORE,
  bufferDaysAfter = BUFFER_DAYS_AFTER,
  ignoreBookingId,
}: UnitAvailabilityArgs): boolean {
  const selected: DateRange = {
    start: toDate(selectedStartDate),
    end: toDate(selectedEndDate),
  };
  const bookings = ignoreBookingId
    ? (existingBookings ?? []).filter((b) => b.id !== ignoreBookingId)
    : existingBookings ?? [];

  return !getBlockedDateRangesForUnit(unitId, bookings, bufferDaysBefore, bufferDaysAfter).some(
    (blocked) => rangesOverlap(selected, blocked),
  );
}

export interface ProductUnitLike {
  id: string;
  product_id?: string;
}

export interface ProductAvailabilityArgs {
  productId: string;
  selectedStartDate: string | Date;
  selectedEndDate: string | Date;
  productUnits: ProductUnitLike[];
  existingBookings: BookingLike[];
  bufferDaysBefore?: number;
  bufferDaysAfter?: number;
  ignoreBookingId?: string;
}

/** true when at least one unit of the product is free for the selected range. */
export function isProductAvailableForDateRange({
  productId,
  selectedStartDate,
  selectedEndDate,
  productUnits,
  existingBookings,
  bufferDaysBefore,
  bufferDaysAfter,
  ignoreBookingId,
}: ProductAvailabilityArgs): boolean {
  const units = (productUnits ?? []).filter(
    (u) => !u.product_id || u.product_id === productId,
  );
  return units.some((u) =>
    isUnitAvailableForDateRange({
      unitId: u.id,
      selectedStartDate,
      selectedEndDate,
      existingBookings,
      bufferDaysBefore,
      bufferDaysAfter,
      ignoreBookingId,
    }),
  );
}

/** First unit free for the selected range, or null. */
export function findAvailableUnitForDateRange(
  args: ProductAvailabilityArgs,
): ProductUnitLike | null {
  const units = (args.productUnits ?? []).filter(
    (u) => !u.product_id || u.product_id === args.productId,
  );
  return (
    units.find((u) =>
      isUnitAvailableForDateRange({
        unitId: u.id,
        selectedStartDate: args.selectedStartDate,
        selectedEndDate: args.selectedEndDate,
        existingBookings: args.existingBookings,
        bufferDaysBefore: args.bufferDaysBefore,
        bufferDaysAfter: args.bufferDaysAfter,
        ignoreBookingId: args.ignoreBookingId,
      }),
    ) ?? null
  );
}
