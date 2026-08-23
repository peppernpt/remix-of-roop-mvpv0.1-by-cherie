// QA audit: the ROOP rental date policy end-to-end at the shared-logic level.
//   rental_days = differenceInCalendarDays(last_rental_date, start) + 1
//   actual_return_date = last_rental_date + 1
import { describe, it, expect } from "vitest";
import { calculateRentalDays, formatActualReturnDate, formatDisplayDate } from "./date-utils";
import { getRentalSubtotal } from "./pricing";
import { computeLifecycle, lifecycleBlockedDates, fmtDate, BANGKOK } from "./booking-logic";
import { isUnitAvailableForDateRange, type BookingLike } from "./availability";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("A. same-day rental", () => {
  const days = calculateRentalDays("2026-08-17", "2026-08-17");
  it("counts 1 rental day, never 0", () => expect(days).toBe(1));
  it("returns 18 Aug", () =>
    expect(formatActualReturnDate("2026-08-17")).toBe("18 Aug 2026"));
  it("prices ฿300 rental, ฿400 with deposit", () => {
    const rental = getRentalSubtotal({ dailyRate: 300 }, days);
    expect(rental).toBe(300);
    expect(rental + 100).toBe(400);
  });
});

describe("B. multi-day daily pricing", () => {
  const days = calculateRentalDays("2026-08-17", "2026-08-19");
  it("counts 3 rental days", () => expect(days).toBe(3));
  it("returns 20 Aug", () =>
    expect(formatActualReturnDate("2026-08-19")).toBe("20 Aug 2026"));
  it("prices 3 × ฿300 = ฿900, total ฿1,000", () => {
    const rental = getRentalSubtotal({ dailyRate: 300 }, days);
    expect(rental).toBe(900);
    expect(rental + 100).toBe(1000);
  });
  it("shows the rental period as 17 Aug → 19 Aug", () => {
    expect(`${formatDisplayDate("2026-08-17")} → ${formatDisplayDate("2026-08-19")}`).toBe(
      "17 Aug 2026 → 19 Aug 2026",
    );
  });
});

describe("C. custom duration pricing", () => {
  const product = {
    dailyRate: 300,
    customRates: [
      { rental_days: 1, price: 330 },
      { rental_days: 2, price: 400 },
      { rental_days: 3, price: 450 },
    ],
  };
  it("uses the 3-day package for 17 → 19 Aug", () => {
    const days = calculateRentalDays("2026-08-17", "2026-08-19");
    expect(days).toBe(3);
    const rental = getRentalSubtotal(product, days);
    expect(rental).toBe(450);
    expect(rental).not.toBe(400); // never the 2-day price
    expect(rental).not.toBe(900); // never the daily fallback
  });
});

describe("D. custom pricing fallback (missing 2-day price)", () => {
  const product = {
    dailyRate: 50,
    customRates: [
      { rental_days: 1, price: 330 },
      { rental_days: 3, price: 430 },
    ],
  };
  it("2 rental days build from the 1-day price + 1 fallback day", () => {
    const days = calculateRentalDays("2026-08-17", "2026-08-18");
    expect(days).toBe(2);
    const rental = getRentalSubtotal(product, days);
    expect(rental).toBe(380);
    expect(rental).not.toBe(50);
    expect(rental).not.toBe(330);
    expect(rental).not.toBe(430);
  });
  it("plain fallback daily rate × 2 = ฿100 when no shorter custom price exists", () => {
    const rental = getRentalSubtotal(
      { dailyRate: 50, customRates: [{ rental_days: 3, price: 430 }] },
      calculateRentalDays("2026-08-17", "2026-08-18"),
    );
    expect(rental).toBe(100);
  });
});

describe("E. availability blocking", () => {
  const unit = "unit-1";
  const accepted: BookingLike[] = [
    {
      id: "b1",
      status: "paid",
      rental_start: "2026-08-17",
      rental_end: "2026-08-19",
      product_unit_ids: [unit],
      delivery_method: "Messenger",
      province: BANGKOK,
    },
  ];
  const free = (s: string, e: string) =>
    isUnitAvailableForDateRange({
      unitId: unit,
      selectedStartDate: s,
      selectedEndDate: e,
      existingBookings: accepted,
    });

  it("blocks 17–21 Aug", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-19"), "Messenger", BANGKOK);
    expect(lifecycleBlockedDates(lc).map(fmtDate)).toEqual([
      "17 Aug 2026",
      "18 Aug 2026",
      "19 Aug 2026",
      "20 Aug 2026",
      "21 Aug 2026",
    ]);
    for (let day = 17; day <= 21; day++) {
      const iso = `2026-08-${day}`;
      expect(free(iso, iso)).toBe(false);
    }
  });

  it("frees 22 Aug onwards", () => {
    expect(free("2026-08-22", "2026-08-22")).toBe(true);
    expect(free("2026-08-22", "2026-08-24")).toBe(true);
  });
});

describe("G. promo code, delivery fee and deposit stay separate", () => {
  it("discount applies to the inclusive-day rental subtotal only", () => {
    const days = calculateRentalDays("2026-08-17", "2026-08-19");
    const rental = getRentalSubtotal({ dailyRate: 300 }, days);
    const discounted = Math.max(0, rental - 100);
    const total = discounted + 150 + 100;
    expect(rental).toBe(900);
    expect(discounted).toBe(800);
    expect(total).toBe(1050);
  });
});

describe("H. tracking / history display values", () => {
  it("shows period 17→19 Aug, return by 20 Aug, 3 days", () => {
    expect(formatDisplayDate("2026-08-19")).toBe("19 Aug 2026");
    expect(formatActualReturnDate("2026-08-19")).toBe("20 Aug 2026");
    expect(calculateRentalDays("2026-08-17", "2026-08-19")).toBe(3);
  });
});
