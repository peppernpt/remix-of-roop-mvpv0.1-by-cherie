import { describe, it, expect } from "vitest";
import {
  getRentalSubtotal,
  isCustomPriced,
  normalizeCustomRates,
  findCustomRate,
} from "./pricing";
import { calculateRentalDays } from "./date-utils";

const plain = { dailyRate: 300 };
const custom = {
  dailyRate: 300,
  customRates: [
    { rental_days: 2, price: 550 },
    { rental_days: 3, price: 600 },
  ],
};

describe("getRentalSubtotal", () => {
  it("A. falls back to daily rate when no custom pricing", () => {
    expect(getRentalSubtotal(plain, 3)).toBe(900);
    expect(getRentalSubtotal({ ...plain, customRates: [] }, 3)).toBe(900);
  });

  it("B. uses custom prices for exact durations, falls back otherwise", () => {
    expect(getRentalSubtotal(custom, 1)).toBe(300);
    expect(getRentalSubtotal(custom, 2)).toBe(550);
    expect(getRentalSubtotal(custom, 3)).toBe(600);
    expect(getRentalSubtotal(custom, 4)).toBe(900); // 600 (3d) + 300 × 1 extra day
  });

  it("returns 0 for non-positive durations", () => {
    expect(getRentalSubtotal(custom, 0)).toBe(0);
    expect(getRentalSubtotal(custom, -2)).toBe(0);
  });

  it("flags custom-priced durations", () => {
    expect(isCustomPriced(custom, 2)).toBe(true);
    expect(isCustomPriced(custom, 4)).toBe(false);
    expect(isCustomPriced(plain, 2)).toBe(false);
  });

  it("F. promo discount floors at 0 on top of a custom subtotal", () => {
    const subtotal = getRentalSubtotal(custom, 2); // 550
    const discounted = Math.max(0, subtotal - 600);
    expect(discounted).toBe(0);
  });
});

describe("normalizeCustomRates", () => {
  it("drops invalid rows, dedupes and sorts", () => {
    expect(
      normalizeCustomRates([
        { rental_days: 3, price: 600 },
        { rental_days: "2", price: "550" },
        { rental_days: 0, price: 100 },
        { rental_days: 2, price: 500 },
        { rental_days: 4, price: -1 },
      ]),
    ).toEqual([
      { rental_days: 2, price: 500 },
      { rental_days: 3, price: 600 },
    ]);
  });

  it("findCustomRate returns null when absent", () => {
    expect(findCustomRate(null, 2)).toBeNull();
    expect(findCustomRate([{ rental_days: 2, price: 550 }], 5)).toBeNull();
  });
});

describe("fallback builds from closest previous custom price", () => {
  const p = {
    dailyRate: 50,
    customRates: [
      { rental_days: 1, price: 330 },
      { rental_days: 3, price: 430 },
    ],
  };
  it("matches the required table", () => {
    expect(getRentalSubtotal(p, 1)).toBe(330);
    expect(getRentalSubtotal(p, 2)).toBe(380);
    expect(getRentalSubtotal(p, 3)).toBe(430);
    expect(getRentalSubtotal(p, 4)).toBe(480);
    expect(getRentalSubtotal(p, 5)).toBe(530);
    expect(getRentalSubtotal(p, 6)).toBe(580);
  });
  it("uses daily rate when no shorter custom price exists", () => {
    const q = { dailyRate: 50, customRates: [{ rental_days: 3, price: 430 }] };
    expect(getRentalSubtotal(q, 1)).toBe(50);
    expect(getRentalSubtotal(q, 2)).toBe(100);
    expect(getRentalSubtotal({ dailyRate: 50 }, 3)).toBe(150);
  });
});

describe("C. custom duration pricing with actual-day counting", () => {
  const p = {
    dailyRate: 300,
    customRates: [
      { rental_days: 1, price: 330 },
      { rental_days: 2, price: 400 },
      { rental_days: 3, price: 450 },
    ],
  };
  it("17 Aug → 19 Aug = 3 rental days = ฿450", () => {
    const days = calculateRentalDays("2026-08-17", "2026-08-19");
    expect(days).toBe(3);
    expect(getRentalSubtotal(p, days)).toBe(450);
  });
  it("same-day rental = 1 day = ฿330", () => {
    expect(getRentalSubtotal(p, calculateRentalDays("2026-08-17", "2026-08-17"))).toBe(330);
  });
  it("falls back to daily rate × days when no custom price", () => {
    expect(getRentalSubtotal({ dailyRate: 300 }, calculateRentalDays("2026-08-17", "2026-08-19"))).toBe(900);
  });
});
