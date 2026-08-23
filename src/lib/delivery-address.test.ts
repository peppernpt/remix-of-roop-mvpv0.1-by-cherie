import { describe, it, expect } from "vitest";
import {
  resolveOrderDeliveryAddress,
  formatRegisteredAddress,
  NO_ORDER_ADDRESS,
} from "./delivery-address";

describe("resolveOrderDeliveryAddress", () => {
  it("returns the order-specific snapshot", () => {
    expect(resolveOrderDeliveryAddress("Thonglor 10")).toBe("Thonglor 10");
  });

  it("keeps the snapshot across every lifecycle status", () => {
    const statuses = [
      "pending_vendor_review",
      "approved_waiting_payment",
      "payment_submitted",
      "paid",
      "to_deliver",
      "on_delivery",
      "on_rent",
      "on_return",
      "for_review",
      "completed",
      "cancelled",
      "rejected",
    ];
    // Status is never an input to address resolution — the snapshot is stable.
    for (const _status of statuses) {
      expect(resolveOrderDeliveryAddress("Thonglor 10")).toBe("Thonglor 10");
    }
  });

  it("never falls back to the registered address for old bookings", () => {
    expect(resolveOrderDeliveryAddress(null)).toBeNull();
    expect(resolveOrderDeliveryAddress(undefined)).toBeNull();
  });

  it("treats blank snapshots as missing", () => {
    expect(resolveOrderDeliveryAddress("   ")).toBeNull();
  });

  it("exposes an explicit empty-state message", () => {
    expect(NO_ORDER_ADDRESS).toBe("No delivery address saved for this order.");
  });

  it("formats a missing registered address safely", () => {
    expect(formatRegisteredAddress(null)).toBe("No address on file");
  });

  it("formats a registered address without affecting order address", () => {
    expect(
      formatRegisteredAddress({
        address_line1: "123 Street",
        city: "Bangkok",
        postal_code: "10110",
        country: "TH",
      }),
    ).toBe("123 Street, Bangkok, 10110, TH");
  });
});
