// ROOP — vendor approval-time availability re-check.
//
// Uses the shared date-based helper in ./availability. No duplicate overlap
// logic lives here: this module only fetches the data the helper needs and
// resolves a unit assignment for the booking being approved.

import { supabase } from "@/integrations/supabase/client";
import {
  isUnitAvailableForDateRange,
  findAvailableUnitForDateRange,
  type BookingLike,
} from "./availability";

export const APPROVAL_CONFLICT_MESSAGE =
  "This item is no longer available for the selected dates. Please reject this request or ask the customer to choose another date.";

export interface ApprovalItem {
  /** booking_items.id */
  id: string;
  productId: string;
  productUnitId: string | null;
}

export interface ApprovalCheckArgs {
  bookingId: string;
  rentalStart: string;
  rentalEnd: string;
  items: ApprovalItem[];
}

export interface ApprovalCheckResult {
  ok: boolean;
  /** Items whose unit must be swapped: booking_items.id → new product_unit_id. */
  reassignments: { bookingItemId: string; productUnitId: string }[];
  message?: string;
}

/**
 * Re-check that every item of a pending booking can still be served for the
 * requested dates. Falls back to another unit of the same product when the
 * originally assigned unit is now blocked.
 *
 * Read-only: never writes bookings, booking_items or product_units.
 */
export async function checkApprovalAvailability({
  bookingId,
  rentalStart,
  rentalEnd,
  items,
}: ApprovalCheckArgs): Promise<ApprovalCheckResult> {
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  if (productIds.length === 0) return { ok: true, reassignments: [] };

  // All physical units of the involved products (archived units excluded).
  const { data: unitRows, error: uErr } = await supabase
    .from("product_units")
    .select("id, product_id, is_active")
    .in("product_id", productIds);
  if (uErr) throw uErr;
  const units = (unitRows ?? []).filter((u: any) => u.is_active !== false);

  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0) {
    return { ok: false, reassignments: [], message: APPROVAL_CONFLICT_MESSAGE };
  }

  // Bookings that touch any of those units.
  const { data: itemRows, error: iErr } = await supabase
    .from("booking_items")
    .select("booking_id, product_unit_id")
    .in("product_unit_id", unitIds);
  if (iErr) throw iErr;

  const bookingIds = [...new Set((itemRows ?? []).map((r) => r.booking_id))];
  let existingBookings: BookingLike[] = [];
  if (bookingIds.length) {
    const { data: bookingRows, error: bErr } = await supabase
      .from("bookings")
      .select("id, status, rental_start, rental_end, delivery_method")
      .in("id", bookingIds);
    if (bErr) throw bErr;
    existingBookings = (bookingRows ?? []).map((b) => ({
      id: b.id,
      status: b.status,
      rental_start: b.rental_start,
      rental_end: b.rental_end,
      delivery_method: b.delivery_method,
      product_unit_ids: (itemRows ?? [])
        .filter((r) => r.booking_id === b.id && r.product_unit_id)
        .map((r) => r.product_unit_id as string),
    }));
  }

  const reassignments: ApprovalCheckResult["reassignments"] = [];
  // Units already claimed within this same approval pass.
  const claimed = new Set<string>();

  for (const item of items) {
    const productUnits = units.filter((u) => u.product_id === item.productId);
    const free = (unitId: string) =>
      !claimed.has(unitId) &&
      isUnitAvailableForDateRange({
        unitId,
        selectedStartDate: rentalStart,
        selectedEndDate: rentalEnd,
        existingBookings,
        ignoreBookingId: bookingId,
      });

    if (item.productUnitId && free(item.productUnitId)) {
      claimed.add(item.productUnitId);
      continue;
    }

    const alternative = findAvailableUnitForDateRange({
      productId: item.productId,
      selectedStartDate: rentalStart,
      selectedEndDate: rentalEnd,
      productUnits: productUnits.filter((u) => !claimed.has(u.id)),
      existingBookings,
      ignoreBookingId: bookingId,
    });

    if (!alternative) {
      return { ok: false, reassignments: [], message: APPROVAL_CONFLICT_MESSAGE };
    }
    claimed.add(alternative.id);
    reassignments.push({ bookingItemId: item.id, productUnitId: alternative.id });
  }

  return { ok: true, reassignments };
}
