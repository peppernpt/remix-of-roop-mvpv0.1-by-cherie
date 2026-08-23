import { describe, it, expect, beforeEach } from "vitest";
import { readBag, addToBag, bagCount, type BagItem } from "@/lib/bag-store";
import { setActiveUser, clearCustomerScopedState, scopedKey, getScopeId } from "@/lib/user-scope";

const USER_ONE = "user-one-id";
const USER_TWO = "user-two-id";

const makeItem = (overrides: Partial<BagItem> = {}): BagItem => ({
  id: `i-${Math.random()}`,
  productId: "product-1",
  productName: "Silk Dress",
  productImage: "img.jpg",
  vendorId: "vendor-1",
  vendorName: "Store",
  vendorDepositPerItem: 1000,
  color: "Black",
  size: "M",
  province: "Bangkok",
  address: "User Two Address",
  startDate: "2026-08-03",
  endDate: "2026-08-05",
  days: 3,
  dailyRate: 500,
  rentalTotal: 1500,
  depositTotal: 1000,
  deliveryMethod: "standard" as BagItem["deliveryMethod"],
  addedAt: new Date().toISOString(),
  ...overrides,
});

const DRAFT_PREFIX = "roop:booking-draft:";

describe("cross-user data isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("User Two → logout → User One sees no bag or draft from User Two", () => {
    setActiveUser(USER_TWO);
    addToBag(makeItem());
    sessionStorage.setItem(
      scopedKey(DRAFT_PREFIX, "product-1"),
      JSON.stringify({ address: "User Two Address", province: "Bangkok", promoCode: "USER2PROMO" })
    );
    expect(bagCount()).toBe(1);

    // Logout
    setActiveUser(null);
    clearCustomerScopedState(null);
    expect(bagCount()).toBe(0);

    // User One logs in on the same browser
    setActiveUser(USER_ONE);
    expect(getScopeId()).toBe(USER_ONE);
    expect(readBag()).toEqual([]);
    expect(sessionStorage.getItem(scopedKey(DRAFT_PREFIX, "product-1"))).toBeNull();

    // Nothing of User Two's survives anywhere in storage
    const all = [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage),
    ].map((k) => `${k}${localStorage.getItem(k) ?? sessionStorage.getItem(k) ?? ""}`);
    expect(all.join("|")).not.toContain("User Two Address");
    expect(all.join("|")).not.toContain("USER2PROMO");
  });

  it("User One → logout → User Two is isolated in reverse too", () => {
    setActiveUser(USER_ONE);
    addToBag(makeItem({ address: "User One Address" }));
    setActiveUser(null);
    setActiveUser(USER_TWO);
    expect(readBag()).toEqual([]);
  });

  it("direct account switch without logout still purges the previous user", () => {
    setActiveUser(USER_TWO);
    addToBag(makeItem());
    setActiveUser(USER_ONE);
    expect(readBag()).toEqual([]);
  });

  it("keys are namespaced by user id", () => {
    setActiveUser(USER_TWO);
    addToBag(makeItem());
    expect(localStorage.getItem(`roop:bag:v1:${USER_TWO}`)).not.toBeNull();
    expect(localStorage.getItem("roop:bag:v1")).toBeNull();
  });

  it("guest data is handed to the user who signs in, then isolated", () => {
    setActiveUser(null);
    addToBag(makeItem({ address: "Guest Address" }));
    setActiveUser(USER_ONE);
    // Guest bag migrated to the account that just signed in
    expect(readBag()).toHaveLength(1);
    expect(localStorage.getItem("roop:bag:v1:guest")).toBeNull();

    // ...and it does not follow the next account
    setActiveUser(null);
    setActiveUser(USER_TWO);
    expect(readBag()).toEqual([]);
  });
});
