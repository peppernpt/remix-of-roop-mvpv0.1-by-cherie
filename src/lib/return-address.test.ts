import { describe, it, expect } from "vitest";
import { formatReturnAddress } from "./return-address";

describe("formatReturnAddress", () => {
  it("formats a full store address", () => {
    expect(
      formatReturnAddress({
        store_name: "RentCHOM",
        store_address: "Thonglor 123",
        subdistrict: "Wattana",
        city: "Bangkok",
        postal_code: "10110",
      }),
    ).toBe("RentCHOM — Thonglor 123, Wattana, Bangkok, 10110");
  });

  it("skips missing parts", () => {
    expect(
      formatReturnAddress({ store_name: "RentCHOM", city: "Bangkok" }),
    ).toBe("RentCHOM — Bangkok");
  });

  it("works without a store name", () => {
    expect(formatReturnAddress({ store_address: "Thonglor 123" })).toBe("Thonglor 123");
  });

  it("returns null when there is no address", () => {
    expect(formatReturnAddress({ store_name: "RentCHOM" })).toBeNull();
    expect(formatReturnAddress({ store_name: "RentCHOM", city: "  " })).toBeNull();
    expect(formatReturnAddress(null)).toBeNull();
    expect(formatReturnAddress(undefined)).toBeNull();
  });
});
