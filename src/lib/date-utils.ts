// ROOP — shared, timezone-safe date handling for rental dates.
//
// Rental dates are CALENDAR dates (date-only). They must never be shifted by
// UTC conversion. Always use these helpers instead of ad-hoc
// `toISOString().slice(0,10)` / `new Date("2026-08-03")` calls.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date → "YYYY-MM-DD" (no UTC shift). */
export function formatDateForDatabase(date: Date | string): string {
  if (typeof date === "string") {
    if (DATE_ONLY.test(date)) return date;
    return formatDateForDatabase(parseDatabaseDate(date));
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * "YYYY-MM-DD" (or a legacy ISO timestamp) → local Date at midnight.
 * Date-only strings are built from parts so they never shift a day.
 */
export function parseDatabaseDate(value: string | Date): Date {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const m = DATE_ONLY.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value); // legacy timestamp: interpret in local time
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Display format used across the app: "3 Aug 2026". */
export function formatDisplayDate(value: string | Date): string {
  return parseDatabaseDate(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "3 Aug 2026 → 8 Aug 2026" */
export function formatDisplayDateRange(
  start: string | Date,
  end: string | Date,
  separator = "→",
): string {
  return `${formatDisplayDate(start)} ${separator} ${formatDisplayDate(end)}`;
}

/**
 * Rental days = ACTUAL calendar days the customer keeps the item, inclusive of
 * both the start date and the last rental date
 * (17 Aug → 17 Aug = 1 day, 17 Aug → 19 Aug = 3 days).
 * The actual return happens the day after the last rental date.
 */
export function calculateRentalDays(
  start: string | Date,
  lastRentalDate: string | Date,
): number {
  const s = parseDatabaseDate(start).getTime();
  const e = parseDatabaseDate(lastRentalDate).getTime();
  return Math.max(0, Math.round((e - s) / 86400000) + 1);
}

/** Shared alias with the new policy wording. */
export const getRentalDays = calculateRentalDays;

/** Actual return date = last rental date + 1 calendar day. */
export function getActualReturnDate(lastRentalDate: string | Date): Date {
  const d = parseDatabaseDate(lastRentalDate);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Formatted actual return date, e.g. "20 Aug 2026". */
export function formatActualReturnDate(lastRentalDate: string | Date): string {
  return formatDisplayDate(getActualReturnDate(lastRentalDate));
}

