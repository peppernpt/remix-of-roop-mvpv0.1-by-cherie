import { describe, it, expect } from "vitest";
import {
  findEarlierOccupyingBooking,
  isPhysicalFulfilmentStatus,
  type OccupancyBookingRow,
} from "./unit-occupancy";

const row = (o: Partial<OccupancyBookingRow>): OccupancyBookingRow => ({
  id: "a",
  status: "on_rent",
  rental_start: "2026-08-17",
  created_at: "2026-08-01T00:00:00Z",
  product_unit_id: "u1",
  ...o,
});

describe("unit occupancy gating", () => {
  it("blocks a later booking while an earlier one is on rent", () => {
    const res = findEarlierOccupyingBooking(
      [row({ id: "A", status: "on_rent", rental_start: "2026-08-17" })],
      { id: "B", rentalStart: "2026-09-01", createdAt: "2026-08-10T00:00:00Z" },
    );
    expect(res.blocked).toBe(true);
    expect(res.blockingBookingId).toBe("A");
  });

  it("does not block when the earlier booking is completed", () => {
    const res = findEarlierOccupyingBooking(
      [row({ id: "A", status: "completed", rental_start: "2026-08-17" })],
      { id: "B", rentalStart: "2026-09-01" },
    );
    expect(res.blocked).toBe(false);
  });

  it("does not block against itself", () => {
    const res = findEarlierOccupyingBooking(
      [row({ id: "B", status: "on_rent", rental_start: "2026-08-17" })],
      { id: "B", rentalStart: "2026-08-17" },
    );
    expect(res.blocked).toBe(false);
  });

  it("does not block against a LATER booking", () => {
    const res = findEarlierOccupyingBooking(
      [row({ id: "C", status: "to_deliver", rental_start: "2026-10-01" })],
      { id: "B", rentalStart: "2026-09-01" },
    );
    expect(res.blocked).toBe(false);
  });

  it("treats payment stages as non-occupying", () => {
    expect(isPhysicalFulfilmentStatus("payment_submitted")).toBe(false);
    expect(isPhysicalFulfilmentStatus("for_review")).toBe(true);
  });
});
