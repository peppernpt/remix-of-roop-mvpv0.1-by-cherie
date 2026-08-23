import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock -----------------------------------------------------
type BookingRow = { id: string; status: string };
type ItemRow = { product_unit_id: string; booking_id: string };

const db = {
  items: [] as ItemRow[],
  bookings: [] as BookingRow[],
  units: [] as { id: string; status: string; current_booking_id: string | null }[],
};

const updates: Array<{ patch: any; ids: string[]; eqBooking?: string }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      if (table === "booking_items") {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => ({
              data: db.items
                .filter((i) => ids.includes(i.product_unit_id))
                .map((i) => ({
                  ...i,
                  bookings: db.bookings.find((b) => b.id === i.booking_id) ?? null,
                })),
              error: null,
            }),
          }),
        };
      }
      // product_units
      return {
        update: (patch: any) => {
          const rec: any = { patch, ids: [] as string[] };
          const chain = {
            in: (_c: string, ids: string[]) => {
              rec.ids = ids;
              updates.push(rec);
              applyUpdate(rec);
              return {
                ...chain,
                eq: (_c2: string, val: string) => {
                  rec.eqBooking = val;
                  return { error: null };
                },
                error: null,
                then: undefined,
              };
            },
          } as any;
          return chain;
        },
      };
    },
  },
}));

const applyUpdate = (rec: { patch: any; ids: string[] }) => {
  for (const u of db.units) {
    if (rec.ids.includes(u.id)) Object.assign(u, rec.patch);
  }
};

import { releaseUnitsForCancelledBooking } from "./cancellation";
import { isUnitAvailableForDateRange, type BookingLike } from "./availability";

beforeEach(() => {
  db.items = [];
  db.bookings = [];
  db.units = [];
  updates.length = 0;
});

const b = (status: string): BookingLike => ({
  id: "b-cancelled",
  status,
  rental_start: "2026-08-07",
  rental_end: "2026-08-09",
  product_unit_ids: ["u1"],
});

const free = (bookings: BookingLike[], start: string, end: string) =>
  isUnitAvailableForDateRange({
    unitId: "u1",
    selectedStartDate: start,
    selectedEndDate: end,
    existingBookings: bookings,
  });

describe("cancelled / rejected availability", () => {
  it("cancelled booking does not block rental dates or cleaning buffer", () => {
    expect(free([b("cancelled")], "2026-08-07", "2026-08-09")).toBe(true);
    expect(free([b("cancelled")], "2026-08-10", "2026-08-11")).toBe(true);
  });

  it("rejected booking does not block rental dates or cleaning buffer", () => {
    expect(free([b("rejected")], "2026-08-07", "2026-08-09")).toBe(true);
    expect(free([b("rejected")], "2026-08-10", "2026-08-11")).toBe(true);
  });

  it("an overlapping active booking still blocks the same dates", () => {
    const other: BookingLike = {
      id: "b-active",
      status: "paid",
      rental_start: "2026-08-07",
      rental_end: "2026-08-09",
      product_unit_ids: ["u1"],
    };
    expect(free([b("cancelled"), other], "2026-08-07", "2026-08-09")).toBe(false);
  });
});

describe("releaseUnitsForCancelledBooking", () => {
  it("resets the unit to available and clears current_booking_id when safe", async () => {
    db.units = [{ id: "u1", status: "reserved", current_booking_id: "b-cancelled" }];
    db.items = [{ product_unit_id: "u1", booking_id: "b-cancelled" }];
    db.bookings = [{ id: "b-cancelled", status: "cancelled" }];

    const res = await releaseUnitsForCancelledBooking({
      bookingId: "b-cancelled",
      unitIds: ["u1"],
    });

    expect(res.releasedUnitIds).toEqual(["u1"]);
    expect(db.units[0]).toMatchObject({ status: "available", current_booking_id: null });
  });

  it("keeps the unit reserved when another active booking still holds it", async () => {
    db.units = [{ id: "u1", status: "reserved", current_booking_id: "b-cancelled" }];
    db.items = [
      { product_unit_id: "u1", booking_id: "b-cancelled" },
      { product_unit_id: "u1", booking_id: "b-active" },
    ];
    db.bookings = [
      { id: "b-cancelled", status: "cancelled" },
      { id: "b-active", status: "paid" },
    ];

    const res = await releaseUnitsForCancelledBooking({
      bookingId: "b-cancelled",
      unitIds: ["u1"],
    });

    expect(res.releasedUnitIds).toEqual([]);
    expect(res.keptUnitIds).toEqual(["u1"]);
    expect(db.units[0].status).toBe("reserved");
  });

  it("ignores other non-blocking bookings on the same unit", async () => {
    db.units = [{ id: "u1", status: "reserved", current_booking_id: "b-cancelled" }];
    db.items = [
      { product_unit_id: "u1", booking_id: "b-cancelled" },
      { product_unit_id: "u1", booking_id: "b-old" },
    ];
    db.bookings = [
      { id: "b-cancelled", status: "cancelled" },
      { id: "b-old", status: "completed" },
    ];

    const res = await releaseUnitsForCancelledBooking({
      bookingId: "b-cancelled",
      unitIds: ["u1"],
    });
    expect(res.releasedUnitIds).toEqual(["u1"]);
  });

  it("does nothing when there are no units", async () => {
    const res = await releaseUnitsForCancelledBooking({ bookingId: "b", unitIds: [] });
    expect(res).toEqual({ releasedUnitIds: [], keptUnitIds: [] });
    expect(updates.length).toBe(0);
  });
});
