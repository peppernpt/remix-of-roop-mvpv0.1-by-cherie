import { describe, it, expect } from "vitest";
import {
  getVendorRollbackAction,
  requiresForwardConfirmation,
  unitStatusForBooking,
  type BookingStatus,
} from "./booking-status";

describe("vendor rollback", () => {
  it("offers one step back for operational stages", () => {
    expect(getVendorRollbackAction("on_delivery")?.to).toBe("to_deliver");
    expect(getVendorRollbackAction("on_rent")?.to).toBe("on_delivery");
    expect(getVendorRollbackAction("on_return")?.to).toBe("on_rent");
    expect(getVendorRollbackAction("completed", true)?.to).toBe("on_return");
  });

  it("never rolls back into payment stages or terminal states", () => {
    (["pending_vendor_review", "approved_waiting_payment", "payment_submitted", "paid", "to_deliver", "cancelled"] as BookingStatus[]).forEach(
      (s) => expect(getVendorRollbackAction(s)).toBeNull(),
    );
    expect(getVendorRollbackAction("completed", false)).toBeNull();
  });

  it("keeps unit status aligned with the rolled-back booking status", () => {
    expect(unitStatusForBooking("to_deliver")).toBe("to_deliver");
    expect(unitStatusForBooking("on_delivery")).toBe("on_delivery");
    expect(unitStatusForBooking("on_rent")).toBe("on_rent");
    expect(unitStatusForBooking("on_return")).toBe("on_return");
  });

  it("never maps an operational rollback to available (calendar stays blocked)", () => {
    (["to_deliver", "on_delivery", "on_rent", "on_return"] as BookingStatus[]).forEach((s) =>
      expect(unitStatusForBooking(s)).not.toBe("available"),
    );
  });

  it("requires confirmation for forward operational moves only", () => {
    expect(requiresForwardConfirmation("to_deliver", "on_delivery")).toBe(true);
    expect(requiresForwardConfirmation("on_return", "completed")).toBe(true);
    expect(requiresForwardConfirmation("pending_vendor_review", "approved_waiting_payment")).toBe(false);
    expect(requiresForwardConfirmation("payment_submitted", "to_deliver")).toBe(false);
  });
});
