// ROOP — cancellation / rejection cleanup for product units.
//
// When a booking is cancelled or rejected, the physical units it held must be
// released so the customer calendar frees the rental dates AND the cleaning
// buffer. A unit is only released when no OTHER booking with a blocking status
// still holds it — otherwise the other booking must keep the dates blocked.
//
// This module never deletes booking_items or booking history.

import { supabase } from "@/integrations/supabase/client";
import { BLOCKING_BOOKING_STATUSES } from "./availability";

export interface ReleaseUnitsArgs {
  /** The booking being cancelled / rejected. */
  bookingId: string;
  /** product_unit ids linked to that booking. */
  unitIds: string[];
}

export interface ReleaseUnitsResult {
  /** Units reset to available with current_booking_id cleared. */
  releasedUnitIds: string[];
  /** Units left untouched because another active booking still holds them. */
  keptUnitIds: string[];
}

/**
 * Release the units of a cancelled/rejected booking when it is safe to do so.
 */
export async function releaseUnitsForCancelledBooking({
  bookingId,
  unitIds,
}: ReleaseUnitsArgs): Promise<ReleaseUnitsResult> {
  const ids = [...new Set((unitIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { releasedUnitIds: [], keptUnitIds: [] };

  // Any other booking still blocking these units?
  const { data: rows, error } = await supabase
    .from("booking_items")
    .select("product_unit_id, booking_id, bookings:booking_id ( id, status )")
    .in("product_unit_id", ids);
  if (error) throw error;

  const blocked = new Set<string>();
  for (const r of (rows ?? []) as any[]) {
    if (r.booking_id === bookingId) continue;
    const status = r.bookings?.status as string | undefined;
    if (status && (BLOCKING_BOOKING_STATUSES as readonly string[]).includes(status)) {
      blocked.add(r.product_unit_id);
    }
  }

  const releasedUnitIds = ids.filter((id) => !blocked.has(id));
  const keptUnitIds = ids.filter((id) => blocked.has(id));

  if (releasedUnitIds.length) {
    const { error: uErr } = await supabase
      .from("product_units")
      .update({ status: "available", current_booking_id: null })
      .in("id", releasedUnitIds);
    if (uErr) throw uErr;
  }

  // Never leave a stale pointer to the cancelled booking on a kept unit.
  if (keptUnitIds.length) {
    const { error: cErr } = await supabase
      .from("product_units")
      .update({ current_booking_id: null })
      .in("id", keptUnitIds)
      .eq("current_booking_id", bookingId);
    if (cErr) throw cErr;
  }

  return { releasedUnitIds, keptUnitIds };
}
