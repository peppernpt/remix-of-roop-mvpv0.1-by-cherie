import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake of the tables the approval check reads.
const db = {
  product_units: [] as any[],
  booking_items: [] as any[],
  bookings: [] as any[],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: keyof typeof db) => ({
      select: () => ({
        in: (col: string, vals: any[]) =>
          Promise.resolve({
            data: db[table].filter((r: any) => vals.includes(r[col])),
            error: null,
          }),
      }),
    }),
  },
}));


const load = async () => {
  vi.resetModules();
  return await import("./approval-availability");
};

const seed = () => {
  db.product_units = [{ id: "u1", product_id: "p1" }];
  db.booking_items = [];
  db.bookings = [];
};

const addBooking = (id: string, status: string, start: string, end: string, unit: string) => {
  db.bookings.push({ id, status, rental_start: start, rental_end: end, delivery_method: null });
  db.booking_items.push({ id: `bi-${id}`, booking_id: id, product_unit_id: unit });
};

describe("checkApprovalAvailability", () => {
  beforeEach(seed);

  const approve = async (bookingId: string, unit = "u1") => {
    const { checkApprovalAvailability } = await load();
    return checkApprovalAvailability({
      bookingId,
      rentalStart: "2026-08-10",
      rentalEnd: "2026-08-12",
      items: [{ id: `bi-${bookingId}`, productId: "p1", productUnitId: unit }],
    });
  };

  it("A. approves when there is no conflict", async () => {
    addBooking("b1", "pending_vendor_review", "2026-08-10", "2026-08-12", "u1");
    const r = await approve("b1");
    expect(r.ok).toBe(true);
    expect(r.reassignments).toHaveLength(0);
  });

  it("B. blocks when an accepted booking overlaps the same unit", async () => {
    addBooking("b0", "approved_waiting_payment", "2026-08-10", "2026-08-12", "u1");
    addBooking("b1", "pending_vendor_review", "2026-08-10", "2026-08-12", "u1");
    const r = await approve("b1");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no longer available/i);
  });

  it("C. allows non-overlapping accepted bookings", async () => {
    addBooking("b0", "approved_waiting_payment", "2026-09-10", "2026-09-12", "u1");
    addBooking("b1", "pending_vendor_review", "2026-08-10", "2026-08-12", "u1");
    expect((await approve("b1")).ok).toBe(true);
  });

  it("D. reassigns to a free unit of the same product", async () => {
    db.product_units.push({ id: "u2", product_id: "p1" });
    addBooking("b0", "approved_waiting_payment", "2026-08-10", "2026-08-12", "u1");
    addBooking("b1", "pending_vendor_review", "2026-08-10", "2026-08-12", "u1");
    const r = await approve("b1");
    expect(r.ok).toBe(true);
    expect(r.reassignments).toEqual([{ bookingItemId: "bi-b1", productUnitId: "u2" }]);
  });

  it("E. completed / cancelled bookings do not block", async () => {
    addBooking("b0", "completed", "2026-08-10", "2026-08-12", "u1");
    addBooking("bx", "cancelled", "2026-08-10", "2026-08-12", "u1");
    addBooking("b1", "pending_vendor_review", "2026-08-10", "2026-08-12", "u1");
    expect((await approve("b1")).ok).toBe(true);
  });

  it("excludes the booking being approved from its own conflict check", async () => {
    addBooking("b1", "approved_waiting_payment", "2026-08-10", "2026-08-12", "u1");
    expect((await approve("b1")).ok).toBe(true);
  });

  it("F. buffer overlap after an accepted booking blocks approval", async () => {
    addBooking("b0", "approved_waiting_payment", "2026-08-06", "2026-08-09", "u1");
    addBooking("b1", "pending_vendor_review", "2026-08-10", "2026-08-12", "u1");
    expect((await approve("b1")).ok).toBe(false);
  });
});
