import { describe, it, expect } from "vitest";
import {
  formatDateForDatabase,
  parseDatabaseDate,
  formatDisplayDate,
  calculateRentalDays,
} from "./date-utils";

describe("date-utils", () => {
  it("serializes a local calendar date without UTC shift", () => {
    expect(formatDateForDatabase(new Date(2026, 7, 3))).toBe("2026-08-03");
    expect(formatDateForDatabase(new Date(2026, 7, 8))).toBe("2026-08-08");
  });

  it("passes date-only strings through unchanged", () => {
    expect(formatDateForDatabase("2026-08-03")).toBe("2026-08-03");
  });

  it("parses date-only strings as local dates", () => {
    const d = parseDatabaseDate("2026-08-03");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 3]);
  });

  it("displays the same calendar day it was given", () => {
    expect(formatDisplayDate("2026-08-03")).toBe("3 Aug 2026");
    expect(formatDisplayDate("2026-08-08")).toBe("8 Aug 2026");
  });

  it("round-trips without drifting a day", () => {
    expect(formatDateForDatabase(parseDatabaseDate("2026-08-03"))).toBe("2026-08-03");
  });

  it("counts actual inclusive calendar rental days", () => {
    expect(calculateRentalDays("2026-08-03", "2026-08-08")).toBe(6);
    expect(calculateRentalDays("2026-08-17", "2026-08-17")).toBe(1);
    expect(calculateRentalDays("2026-08-17", "2026-08-18")).toBe(2);
    expect(calculateRentalDays("2026-08-17", "2026-08-19")).toBe(3);
  });
});
