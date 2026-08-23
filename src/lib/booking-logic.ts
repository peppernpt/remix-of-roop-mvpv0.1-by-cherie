// ROOP Booking Engine — pure logic helpers (no Supabase yet)
// Centralizes all rental rules: lead time, delivery method, lifecycle blocks, vendor deadline.

export type Province = string;
export const BANGKOK = "Bangkok";

export type DeliveryMethod = "Messenger" | "EMS";

export const THAI_PROVINCES = [
  "Bangkok",
  "Chiang Mai",
  "Chiang Rai",
  "Phuket",
  "Krabi",
  "Pattaya (Chonburi)",
  "Khon Kaen",
  "Nakhon Ratchasima",
  "Udon Thani",
  "Surat Thani",
  "Songkhla",
  "Ayutthaya",
  "Nonthaburi",
  "Pathum Thani",
  "Samut Prakan",
];

// ---------- Date helpers (date-only, ignore TZ time) ----------
export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, days: number) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + days);
  return x;
};
export const diffDays = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);

export const isSameDay = (a: Date, b: Date) =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// ---------- Rental days ----------
// The customer selects a START date and a LAST RENTAL DATE (the final day they
// keep the item). The actual return happens the next calendar day.
// rental_days = last_rental_date - rental_start + 1  (actual calendar days,
// inclusive: 17 Aug → 17 Aug = 1 day, 17 Aug → 19 Aug = 3 days)
export function rentalDays(start: Date, lastRentalDate: Date): number {
  return Math.max(0, diffDays(lastRentalDate, start) + 1);
}

/** Shared alias: rental days between start and the selected last rental date. */
export const getRentalDays = rentalDays;

/** Actual return date = last rental date + 1 calendar day. */
export const getActualReturnDate = (lastRentalDate: Date) => addDays(lastRentalDate, 1);

/** Cleaning/buffer days, starting the day after the actual return date. */
export function getCleaningRange(actualReturnDate: Date, bufferDays = 1): Date[] {
  const out: Date[] = [];
  for (let i = 1; i <= Math.max(0, bufferDays); i++) out.push(addDays(actualReturnDate, i));
  return out;
}

/**
 * Full blocked window for a booking: rental period + actual return date +
 * cleaning buffer. `availableAgain` is the first free day.
 */
export function getBlockedDateRange(
  start: Date,
  lastRentalDate: Date,
  bufferDays = 1,
): { start: Date; end: Date; availableAgain: Date } {
  const actualReturn = getActualReturnDate(lastRentalDate);
  const end = addDays(actualReturn, Math.max(0, bufferDays));
  return { start: startOfDay(start), end, availableAgain: addDays(end, 1) };
}


// Bangkok: Messenger allows 1-day rentals, EMS requires 2 days minimum.
// Outside Bangkok: 2 days minimum regardless of method.
export function isValidRentalDuration(
  province: Province,
  days: number,
  method?: DeliveryMethod | "",
): boolean {
  if (days < 1) return false;
  if (province !== BANGKOK) return days >= 2;
  if (method === "EMS") return days >= 2;
  return days >= 1;
}

export const EMS_ONE_DAY_MESSAGE =
  "Parcel Delivery requires a minimum 2-day rental. Choose Messenger for a 1-day rental, or extend your dates.";

// ---------- Display labels ----------
// Internal values stay "Messenger" / "EMS". Customer & vendor UI shows friendly labels.
export const PARCEL_DELIVERY_LABEL = "Parcel Delivery";
export const PARCEL_DELIVERY_HELPER =
  "Shipped by the store’s courier, such as Flash, Kerry, J&T, or EMS.";
export const PARCEL_DELIVERY_HELPER_EXTRA =
  "Parcel Delivery require extra preparation/delivery days before your rental start date.";
export const MESSENGER_HELPER =
  "Direct delivery arranged by the store, usually via Grab or similar services.";

export function deliveryMethodLabel(
  method?: string | null,
): string {
  if (!method) return "";
  const m = String(method).trim().toLowerCase();
  if (m === "ems" || m === "parcel" || m === "parcel delivery") return PARCEL_DELIVERY_LABEL;
  if (m === "messenger") return "Messenger";
  return String(method);
}

// ---------- EMS pre-rental buffer ----------
// EMS only. Full calendar days blocked BEFORE the rental start date.
//   EMS + Bangkok:         2 days
//   EMS + Outside Bangkok: 3 days
// Messenger has no pre-rental buffer (unchanged).
export const EMS_PRE_BUFFER_BANGKOK = 2;
export const EMS_PRE_BUFFER_OUTSIDE = 3;

/** Case/whitespace tolerant Bangkok check. */
export const isBangkok = (province?: Province | "") =>
  (province ?? "").trim().toLowerCase() === BANGKOK.toLowerCase();

export function emsPreRentalBufferDays(province?: Province | ""): number {
  return isBangkok(province) ? EMS_PRE_BUFFER_BANGKOK : EMS_PRE_BUFFER_OUTSIDE;
}


// ---------- Earliest start (lead time) ----------
// Policy: earliest_start_date = request_date + lead_days (request day not counted).
//   Messenger (Bangkok only):  1 day  (unchanged)
//   EMS: the pre-rental buffer days must all fall AFTER today, so
//        earliest start = today + buffer + 1
//        EMS + Bangkok:         3 days
//        EMS + Outside Bangkok: 4 days
// If the product's own next-available date (from inventory) is later, use that.
export function leadDaysFor(province?: Province | "", method?: DeliveryMethod | ""): number {
  if (method === "Messenger") return 1;
  return emsPreRentalBufferDays(province) + 1;
}


export function earliestStartDate(
  now: Date,
  productNextAvailable?: Date,
  province?: Province | "",
  method?: DeliveryMethod | "",
): Date {
  const leadStart = addDays(now, leadDaysFor(province, method));
  if (!productNextAvailable) return leadStart;
  return leadStart > startOfDay(productNextAvailable) ? leadStart : startOfDay(productNextAvailable);
}

// ---------- Delivery method engine ----------
// Chosen BEFORE dates, so it depends on province only.
export function resolveDeliveryOptions(
  province: Province | "",
): { options: DeliveryMethod[]; fixed: boolean } {
  if (!province) return { options: [], fixed: true };
  if (province === BANGKOK) return { options: ["Messenger", "EMS"], fixed: false };
  return { options: ["EMS"], fixed: true };
}

// ---------- Lifecycle block calculator ----------
// Policy: rental_end stores the LAST RENTAL DATE (the final day the customer
// keeps the item). The actual return happens the next calendar day, and the
// cleaning buffer starts after that.
export interface LifecycleRange {
  shipOut?: Date;          // EMS only
  rentalStart: Date;
  rentalEnd: Date;         // = last rental date (as stored)
  lastRentalDate: Date;    // = rentalEnd
  actualReturn: Date;      // = lastRentalDate + 1
  storeReceive?: Date;     // EMS only
  cleaning: Date[];
  availableAgain: Date;
}

export function computeLifecycle(
  start: Date,
  lastRental: Date,
  method: DeliveryMethod,
  province: Province,
): LifecycleRange {
  const s = startOfDay(start);
  const e = startOfDay(lastRental);
  const actualReturn = getActualReturnDate(e);

  if (method === "Messenger") {
    // Bangkok only — 1 cleaning day after the actual return.
    const cleaning = [addDays(actualReturn, 1)];
    const availableAgain = addDays(actualReturn, 2);
    return {
      rentalStart: s,
      rentalEnd: e,
      lastRentalDate: e,
      actualReturn,
      cleaning,
      availableAgain,
    };
  }

  // EMS
  const shipOut = addDays(s, -emsPreRentalBufferDays(province)); // ship by 12pm before rental start

  const storeReceive = addDays(actualReturn, province === BANGKOK ? 1 : 2);
  const cleaning = [addDays(storeReceive, 1)];
  const availableAgain = addDays(storeReceive, 2);
  return {
    shipOut,
    rentalStart: s,
    rentalEnd: e,
    lastRentalDate: e,
    actualReturn,
    storeReceive,
    cleaning,
    availableAgain,
  };
}

// Flatten a lifecycle into the list of blocked dates (inclusive)
export function lifecycleBlockedDates(lc: LifecycleRange): Date[] {
  const out: Date[] = [];
  // EMS: block every pre-rental buffer day (shipOut .. day before start)
  if (lc.shipOut) {
    for (let d = new Date(lc.shipOut); d < lc.rentalStart; d = addDays(d, 1)) out.push(d);
  }
  for (let d = new Date(lc.rentalStart); d <= lc.rentalEnd; d = addDays(d, 1)) out.push(d);
  out.push(lc.actualReturn);
  if (lc.storeReceive) out.push(lc.storeReceive);
  out.push(...lc.cleaning);
  // availableAgain is the first FREE day, so don't block it
  return out;
}


// ---------- Vendor response deadline ----------
export function vendorResponseDeadline(requestTime: Date): Date {
  const t = new Date(requestTime);
  const noon = new Date(t);
  noon.setHours(12, 0, 0, 0);
  if (t.getTime() < noon.getTime()) {
    // same day EOD
    const eod = new Date(t);
    eod.setHours(23, 59, 59, 999);
    return eod;
  }
  // next day 12:00
  const next = addDays(t, 1);
  next.setHours(12, 0, 0, 0);
  return next;
}

// ---------- Pricing ----------
export interface PricingBreakdown {
  rentalTotal: number;
  depositTotal: number;
  grandTotal: number;
}
export function computePricing(dailyRate: number, days: number, depositPerItem: number): PricingBreakdown {
  const rentalTotal = Math.max(0, dailyRate) * Math.max(0, days);
  const depositTotal = Math.max(0, depositPerItem);
  return { rentalTotal, depositTotal, grandTotal: rentalTotal + depositTotal };
}
