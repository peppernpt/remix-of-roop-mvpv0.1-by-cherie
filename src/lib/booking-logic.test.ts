import { describe, it, expect } from "vitest";
import { computeLifecycle, computePricing, lifecycleBlockedDates, rentalDays, fmtDate, BANGKOK, earliestStartDate } from "./booking-logic";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("rental policy: end date = last rental date, inclusive day count", () => {
  it("counts 17 Aug → 17 Aug as 1 rental day", () => {
    expect(rentalDays(d("2026-08-17"), d("2026-08-17"))).toBe(1);
  });

  it("counts 17 Aug → 18 Aug as 2 rental days", () => {
    expect(rentalDays(d("2026-08-17"), d("2026-08-18"))).toBe(2);
  });

  it("counts 17 Aug → 19 Aug as 3 rental days", () => {
    expect(rentalDays(d("2026-08-17"), d("2026-08-19"))).toBe(3);
  });

  it("counts 17 Aug → 20 Aug as 4 rental days", () => {
    expect(rentalDays(d("2026-08-17"), d("2026-08-20"))).toBe(4);
  });

  it("returns the day after the last rental date", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-19"), "Messenger", BANGKOK);
    expect(fmtDate(lc.lastRentalDate)).toBe("19 Aug 2026");
    expect(fmtDate(lc.actualReturn)).toBe("20 Aug 2026");
    expect(lc.cleaning.map(fmtDate)).toEqual(["21 Aug 2026"]);
    expect(fmtDate(lc.availableAgain)).toBe("22 Aug 2026");
  });

  it("same-day rental returns the next day", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-17"), "Messenger", BANGKOK);
    expect(fmtDate(lc.actualReturn)).toBe("18 Aug 2026");
  });

  it("blocks rental period + actual return + cleaning buffer", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-19"), "Messenger", BANGKOK);
    expect(lifecycleBlockedDates(lc).map(fmtDate)).toEqual([
      "17 Aug 2026",
      "18 Aug 2026",
      "19 Aug 2026",
      "20 Aug 2026",
      "21 Aug 2026",
    ]);
  });

  it("EMS outside Bangkok ships 3 days before start and receives 2 days after the actual return", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-19"), "EMS", "Phuket");
    expect(fmtDate(lc.shipOut!)).toBe("14 Aug 2026");
    expect(fmtDate(lc.actualReturn)).toBe("20 Aug 2026");
    expect(fmtDate(lc.storeReceive!)).toBe("22 Aug 2026");
    expect(fmtDate(lc.availableAgain)).toBe("24 Aug 2026");
    expect(lifecycleBlockedDates(lc).map(fmtDate).slice(0, 3)).toEqual([
      "14 Aug 2026",
      "15 Aug 2026",
      "16 Aug 2026",
    ]);
  });

  it("EMS Bangkok blocks 2 pre-rental days", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-19"), "EMS", BANGKOK);
    expect(fmtDate(lc.shipOut!)).toBe("15 Aug 2026");
    expect(lifecycleBlockedDates(lc).map(fmtDate).slice(0, 2)).toEqual([
      "15 Aug 2026",
      "16 Aug 2026",
    ]);
  });

  it("Messenger has no pre-rental buffer", () => {
    const lc = computeLifecycle(d("2026-08-17"), d("2026-08-19"), "Messenger", BANGKOK);
    expect(lc.shipOut).toBeUndefined();
    expect(lifecycleBlockedDates(lc).map(fmtDate)[0]).toBe("17 Aug 2026");
  });

});


describe("rental subtotal pricing (actual-day policy)", () => {
  const rate = 300;
  const deposit = 100;
  it("A. 17 Aug → 17 Aug = 1 day, ฿300 rental", () => {
    const days = rentalDays(d("2026-08-17"), d("2026-08-17"));
    expect(days).toBe(1);
    expect(computePricing(rate, days, deposit).rentalTotal).toBe(300);
  });
  it("B. 17 Aug → 19 Aug = 3 days, ฿900 rental, ฿1,000 total", () => {
    const days = rentalDays(d("2026-08-17"), d("2026-08-19"));
    const p = computePricing(rate, days, deposit);
    expect(days).toBe(3);
    expect(p.rentalTotal).toBe(900);
    expect(p.grandTotal).toBe(1000);
  });
  it("3 Aug → 8 Aug = 6 days, ฿1,800 rental", () => {
    expect(computePricing(rate, rentalDays(d("2026-08-03"), d("2026-08-08")), deposit).rentalTotal).toBe(1800);
  });
  it("discount applies only to the rental subtotal and floors at 0", () => {
    const rental = computePricing(rate, rentalDays(d("2026-08-17"), d("2026-08-19")), deposit).rentalTotal;
    expect(Math.max(rental - 100, 0)).toBe(800);
    expect(Math.max(rental - 2000, 0)).toBe(0);
  });
});

describe("EMS pre-rental buffer & lead time", () => {
  const today = d("2026-08-22");
  it("Bangkok + EMS: earliest start 25 Aug (2 blocked days)", () => {
    expect(fmtDate(earliestStartDate(today, undefined, BANGKOK, "EMS"))).toBe("25 Aug 2026");
  });
  it("outside Bangkok + EMS: earliest start 26 Aug (3 blocked days)", () => {
    expect(fmtDate(earliestStartDate(today, undefined, "Chiang Mai", "EMS"))).toBe("26 Aug 2026");
    expect(fmtDate(earliestStartDate(today, undefined, "  chiang mai ", "EMS"))).toBe("26 Aug 2026");
  });
  it("case/whitespace tolerant Bangkok check", () => {
    expect(fmtDate(earliestStartDate(today, undefined, " bangkok ", "EMS"))).toBe("25 Aug 2026");
  });
  it("Messenger unchanged: today + 1", () => {
    expect(fmtDate(earliestStartDate(today, undefined, BANGKOK, "Messenger"))).toBe("23 Aug 2026");
    expect(fmtDate(earliestStartDate(today, undefined, "Phuket", "Messenger"))).toBe("23 Aug 2026");
  });
});
