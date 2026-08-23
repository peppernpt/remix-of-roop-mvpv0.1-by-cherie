import { describe, it, expect, beforeEach } from "vitest";
import { addToBag, replaceBag, readBag, writeBag, bagCount, type BagItem } from "@/lib/bag-store";
import { setActiveUser, scopedKey } from "@/lib/user-scope";

const makeItem = (overrides: Partial<BagItem> = {}): BagItem => ({
  id: `i-${Math.random()}`,
  productId: "product-a",
  productName: "Product A",
  productImage: "a.jpg",
  vendorId: "vendor-1",
  vendorName: "Store",
  vendorDepositPerItem: 1000,
  color: "Black",
  size: "M",
  province: "Bangkok",
  address: "Addr",
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

describe("one item per rental request", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setActiveUser("user-1");
  });

  it("adds the first item normally", () => {
    expect(addToBag(makeItem()).ok).toBe(true);
    expect(bagCount()).toBe(1);
  });

  it("blocks a second, different product", () => {
    addToBag(makeItem());
    const res = addToBag(makeItem({ productId: "product-b", productName: "Product B" }));
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.existing.productName).toBe("Product A");
    expect(readBag()).toHaveLength(1);
    expect(readBag()[0].productId).toBe("product-a");
  });

  it("replace swaps the single item", () => {
    addToBag(makeItem());
    replaceBag(makeItem({ productId: "product-b", productName: "Product B" }));
    const bag = readBag();
    expect(bag).toHaveLength(1);
    expect(bag[0].productId).toBe("product-b");
  });

  it("rapid repeated adds cannot stack items", () => {
    for (let i = 0; i < 5; i++) addToBag(makeItem());
    expect(readBag()).toHaveLength(1);
  });

  it("stale multi-item storage is truncated to one valid item", () => {
    localStorage.setItem(
      scopedKey("roop:bag:v1:"),
      JSON.stringify([makeItem(), makeItem({ productId: "product-b" })])
    );
    expect(readBag()).toHaveLength(1);
    expect(readBag()[0].productId).toBe("product-a");
  });

  it("writeBag never persists more than one item", () => {
    writeBag([makeItem(), makeItem({ productId: "product-b" })]);
    expect(JSON.parse(localStorage.getItem(scopedKey("roop:bag:v1:"))!)).toHaveLength(1);
  });
});
