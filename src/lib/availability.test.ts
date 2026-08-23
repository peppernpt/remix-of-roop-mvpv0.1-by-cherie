import { formatDateForDatabase } from "./date-utils";
import { describe, it, expect } from "vitest";
import {
  isUnitAvailableForDateRange,
  isProductAvailableForDateRange,
  getBlockedDateRangesForUnit,
  type BookingLike,
} from "./availability";

const UNIT = "unit-1";
const booking = (status: string, start: string, end: string): BookingLike => ({
  id: `${status}-${start}`,
  status,
  rental_start: start,
  rental_end: end,
  product_unit_ids: [UNIT],
});

const check = (bookings: BookingLike[], start: string, end: string) =>
  isUnitAvailableForDateRange({
    unitId: UNIT,
    selectedStartDate: start,
    selectedEndDate: end,
    existingBookings: bookings,
  });

describe("isUnitAvailableForDateRange", () => {
  it("A. pending_vendor_review does not block", () => {
    expect(check([booking("pending_vendor_review", "2026-07-28", "2026-07-30")], "2026-07-29", "2026-07-31")).toBe(true);
  });

  it("B. approved_waiting_payment blocks overlapping dates", () => {
    expect(check([booking("approved_waiting_payment", "2026-07-28", "2026-07-30")], "2026-07-29", "2026-07-31")).toBe(false);
  });

  it("C. non-overlapping accepted booking stays available", () => {
    expect(check([booking("approved_waiting_payment", "2026-07-01", "2026-07-03")], "2026-07-20", "2026-07-22")).toBe(true);
  });

  it("D. completed does not block", () => {
    expect(check([booking("completed", "2026-07-28", "2026-07-30")], "2026-07-29", "2026-07-31")).toBe(true);
  });

  it("E. cancelled does not block", () => {
    expect(check([booking("cancelled", "2026-07-28", "2026-07-30")], "2026-07-29", "2026-07-31")).toBe(true);
  });

  it("F. buffer days block adjacent dates", () => {
    // booking 28–30 + 2 buffer days after → blocked through Aug 1
    expect(check([booking("paid", "2026-07-28", "2026-07-30")], "2026-07-31", "2026-08-01")).toBe(false);
    expect(check([booking("paid", "2026-07-28", "2026-07-30")], "2026-08-02", "2026-08-03")).toBe(true);
  });

  it("ignores a specified booking id", () => {
    const b = booking("paid", "2026-07-28", "2026-07-30");
    expect(
      isUnitAvailableForDateRange({
        unitId: UNIT,
        selectedStartDate: "2026-07-29",
        selectedEndDate: "2026-07-30",
        existingBookings: [b],
        ignoreBookingId: b.id,
      }),
    ).toBe(true);
  });
});

describe("getBlockedDateRangesForUnit", () => {
  it("returns only blocking-status ranges", () => {
    const ranges = getBlockedDateRangesForUnit(UNIT, [
      booking("paid", "2026-07-28", "2026-07-30"),
      booking("cancelled", "2026-08-10", "2026-08-12"),
    ]);
    expect(ranges).toHaveLength(1);
    expect(formatDateForDatabase(ranges[0].end)).toBe("2026-08-01");
  });
});

describe("isProductAvailableForDateRange", () => {
  it("is available when a second unit is free", () => {
    const bookings: BookingLike[] = [
      { id: "b1", status: "paid", rental_start: "2026-07-28", rental_end: "2026-07-30", product_unit_ids: [UNIT] },
    ];
    expect(
      isProductAvailableForDateRange({
        productId: "p1",
        selectedStartDate: "2026-07-29",
        selectedEndDate: "2026-07-30",
        productUnits: [
          { id: UNIT, product_id: "p1" },
          { id: "unit-2", product_id: "p1" },
        ],
        existingBookings: bookings,
      }),
    ).toBe(true);
  });

  it("is unavailable when every unit overlaps", () => {
    const bookings: BookingLike[] = [
      { id: "b1", status: "paid", rental_start: "2026-07-28", rental_end: "2026-07-30", product_unit_ids: [UNIT, "unit-2"] },
    ];
    expect(
      isProductAvailableForDateRange({
        productId: "p1",
        selectedStartDate: "2026-07-29",
        selectedEndDate: "2026-07-30",
        productUnits: [
          { id: UNIT, product_id: "p1" },
          { id: "unit-2", product_id: "p1" },
        ],
        existingBookings: bookings,
      }),
    ).toBe(false);
  });
});

// New "last rental date" policy: rental_end is the final rental day, the actual
// return is the next day, and the cleaning buffer starts after that.
describe("last-rental-date blocking policy", () => {
  const accepted = [
    { ...booking("paid", "2026-08-17", "2026-08-19"), delivery_method: "Messenger", province: "Bangkok" },
  ];

  it("blocks 17–21 Aug (rental period + actual return + cleaning)", () => {
    for (const [s, e] of [
      ["2026-08-17", "2026-08-19"],
      ["2026-08-18", "2026-08-20"],
      ["2026-08-20", "2026-08-21"],
      ["2026-08-21", "2026-08-23"],
    ]) {
      expect(check(accepted, s, e)).toBe(false);
    }
  });

  it("frees 22 Aug onwards", () => {
    expect(check(accepted, "2026-08-22", "2026-08-24")).toBe(true);
  });
});
