// ROOP — physical unit occupancy gating.
//
// A physical unit may carry several future, non-overlapping bookings, but only
// ONE booking can be physically processed at a time. This module answers:
// "is this unit still occupied by an EARLIER booking that is in the physical
// fulfilment lifecycle?" — and if so, later bookings must not advance past
// Payment Submitted.
//
// This does NOT change date availability blocking (see src/lib/availability.ts)
// nor any pricing/payment logic.

import { supabase } from "@/integrations/supabase/client";

/** Booking statuses where the physical item is committed to that booking. */
export const PHYSICAL_LIFECYCLE_STATUSES = [
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
  "for_review",
] as const;

export const PHYSICAL_LIFECYCLE_SET = new Set<string>(PHYSICAL_LIFECYCLE_STATUSES);

/** Statuses a booking must not move INTO while the unit is occupied earlier. */
export const isPhysicalFulfilmentStatus = (s: string) => PHYSICAL_LIFECYCLE_SET.has(s);

export const UNIT_OCCUPIED_MESSAGE =
  "This item is still being used in an earlier booking. You can move this order forward after the item is returned and reviewed.";

export interface OccupancyBookingRow {
  id: string;
  status: string;
  rental_start: string;
  created_at?: string | null;
  product_unit_id: string;
}

export interface OccupancyResult {
  blocked: boolean;
  /** The earlier booking still holding the unit, when blocked. */
  blockingBookingId: string | null;
  productUnitId: string | null;
  message: string | null;
}

/**
 * Pure core: given all booking rows touching this booking's units, find an
 * earlier booking currently in the physical lifecycle.
 */
export function findEarlierOccupyingBooking(
  rows: OccupancyBookingRow[],
  current: { id: string; rentalStart: string; createdAt?: string | null },
): OccupancyResult {
  const candidates = rows
    .filter((r) => r.id !== current.id && isPhysicalFulfilmentStatus(r.status))
    .filter((r) => {
      if (r.rental_start !== current.rentalStart) return r.rental_start < current.rentalStart;
      // Same start date → fall back to creation order.
      return (r.created_at ?? "") <= (current.createdAt ?? "");
    })
    .sort((a, b) => (a.rental_start < b.rental_start ? -1 : a.rental_start > b.rental_start ? 1 : 0));

  const hit = candidates[0];
  if (!hit) return { blocked: false, blockingBookingId: null, productUnitId: null, message: null };
  return {
    blocked: true,
    blockingBookingId: hit.id,
    productUnitId: hit.product_unit_id,
    message: UNIT_OCCUPIED_MESSAGE,
  };
}

/**
 * Live check against Supabase. Returns `blocked: false` when the booking has no
 * assigned units or nothing earlier is occupying them.
 */
export async function checkUnitOccupancy(params: {
  bookingId: string;
  rentalStart: string;
  createdAt?: string | null;
  unitIds: string[];
}): Promise<OccupancyResult> {
  const unitIds = params.unitIds.filter(Boolean);
  const none: OccupancyResult = {
    blocked: false,
    blockingBookingId: null,
    productUnitId: null,
    message: null,
  };
  if (!unitIds.length) return none;

  const { data, error } = await supabase
    .from("booking_items")
    .select("product_unit_id, bookings:booking_id ( id, status, rental_start, created_at )")
    .in("product_unit_id", unitIds);
  if (error || !data) return none;

  const rows: OccupancyBookingRow[] = (data as any[])
    .filter((r) => r.bookings)
    .map((r) => ({
      id: r.bookings.id,
      status: r.bookings.status,
      rental_start: r.bookings.rental_start,
      created_at: r.bookings.created_at ?? null,
      product_unit_id: r.product_unit_id,
    }));

  return findEarlierOccupyingBooking(rows, {
    id: params.bookingId,
    rentalStart: params.rentalStart,
    createdAt: params.createdAt ?? null,
  });
}
