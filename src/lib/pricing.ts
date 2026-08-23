// Shared rental subtotal pricing.
//
// ROOP prices rentals with a required daily rate. Vendors may OPTIONALLY set
// exact total prices for specific rental durations (product_rental_rates).
// When a custom price exists for the exact rental_days, it wins; otherwise we
// fall back to daily_rate × rental_days.
//
// Rental day counting is owned by src/lib/date-utils.ts (last-rental-date
// policy: actual inclusive calendar days) and is NOT recomputed here.

export interface CustomRentalRate {
  rental_days: number;
  price: number;
}

export interface PricedProduct {
  /** Required fallback rate. */
  dailyRate: number;
  /** Optional custom duration prices. */
  customRates?: CustomRentalRate[] | null;
}

/** Normalises DB rows into a clean, deduped, sorted list. */
export function normalizeCustomRates(
  rows: Array<{ rental_days: number | string; price: number | string }> | null | undefined,
): CustomRentalRate[] {
  const map = new Map<number, number>();
  for (const r of rows ?? []) {
    const d = Math.trunc(Number(r.rental_days));
    const p = Number(r.price);
    if (!Number.isFinite(d) || d < 1) continue;
    if (!Number.isFinite(p) || p < 0) continue;
    map.set(d, p);
  }
  return [...map.entries()]
    .map(([rental_days, price]) => ({ rental_days, price }))
    .sort((a, b) => a.rental_days - b.rental_days);
}

/** Returns the custom price for an exact duration, or null when none is set. */
export function findCustomRate(
  customRates: CustomRentalRate[] | null | undefined,
  days: number,
): number | null {
  if (!customRates?.length) return null;
  const d = Math.trunc(Number(days));
  const hit = customRates.find((r) => Math.trunc(Number(r.rental_days)) === d);
  return hit && Number.isFinite(Number(hit.price)) ? Math.max(0, Number(hit.price)) : null;
}

/**
 * Rental subtotal for one item (excludes deposit, delivery fee and discounts).
 *
 * Exact custom price wins. Otherwise we build from the closest previous custom
 * duration price plus the fallback daily rate × missing extra days. With no
 * previous custom price we fall back to daily rate × days.
 */
export function getRentalSubtotal(product: PricedProduct, rentalDays: number): number {
  const days = Math.max(0, Math.trunc(Number(rentalDays) || 0));
  if (days <= 0) return 0;
  const custom = findCustomRate(product.customRates, days);
  if (custom != null) return custom;
  const daily = Math.max(0, Number(product.dailyRate) || 0);
  const base = findClosestPreviousCustomRate(product.customRates, days);
  if (base) return Math.max(0, base.price + daily * (days - base.rental_days));
  return daily * days;
}

/** Nearest custom rate with a strictly shorter duration, or null. */
export function findClosestPreviousCustomRate(
  customRates: CustomRentalRate[] | null | undefined,
  days: number,
): CustomRentalRate | null {
  const d = Math.trunc(Number(days) || 0);
  const prev = normalizeCustomRates(customRates ?? []).filter((r) => r.rental_days < d);
  return prev.length ? prev[prev.length - 1] : null;
}


/** True when the shown subtotal comes from a custom duration price. */
export function isCustomPriced(product: PricedProduct, rentalDays: number): boolean {
  return findCustomRate(product.customRates, Math.trunc(Number(rentalDays) || 0)) != null;
}

/**
 * Display-only starting price: the 1-rental-day price.
 * Custom 1-day price wins; otherwise the fallback daily rate.
 * Returns null when no usable price exists.
 */
export function getStartingPrice(product: PricedProduct): number | null {
  const custom = findCustomRate(product.customRates, 1);
  if (custom != null) return custom;
  const daily = Number(product.dailyRate);
  if (Number.isFinite(daily) && daily > 0) return daily;
  return null;
}
