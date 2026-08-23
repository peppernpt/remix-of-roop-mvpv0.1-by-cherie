// Customer "Bag" — a localStorage-backed cart of pending booking items.
// We store enough info to render the Bag page + create the booking on submit.
// One bag may only contain items from a single vendor at a time (MVP rule).

import type { DeliveryMethod } from "./booking-logic";
import { calculateRentalDays } from "./date-utils";
import { scopedKey } from "./user-scope";

// Bag storage is namespaced per authenticated user (guest scope when signed out)
// so one account can never read another account's bag on the same browser.
const KEY_PREFIX = "roop:bag:v1:";
const key = () => scopedKey(KEY_PREFIX);


export interface BagItem {
  /** Local id, generated client-side. */
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  vendorId: string;
  vendorName: string;
  vendorDepositPerItem: number;
  color: string;
  size: string;
  province: string;
  address: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  days: number;
  dailyRate: number;
  rentalTotal: number;
  depositTotal: number;
  deliveryMethod: DeliveryMethod;
  /** Optional: unit pre-selected by the date-based availability helper. */
  productUnitId?: string;
  addedAt: string;
}

/**
 * ROOP MVP: one item per rental request. The bag never holds more than one
 * item — stale multi-item state (older builds, hand-edited storage) is
 * truncated to the first valid item on read.
 */
export const BAG_LIMIT_MESSAGE =
  "ROOP currently supports one item per rental request. Please remove your current item before adding another one.";

const isValidItem = (i: unknown): i is BagItem =>
  !!i && typeof i === "object" && typeof (i as BagItem).productId === "string";

/**
 * Rental days are ACTUAL inclusive calendar days
 * (last rental date - start + 1). Items persisted by an older build used the
 * nights-style count, so their `days` / `rentalTotal` are stale — drop them
 * instead of showing a wrong duration or subtotal in the Bag.
 */
const hasCurrentDayPolicy = (i: BagItem): boolean => {
  if (!i.startDate || !i.endDate) return false;
  return calculateRentalDays(i.startDate, i.endDate) === Number(i.days);
};

export const readBag = (): BagItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key());
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
    return list.filter(hasCurrentDayPolicy).slice(0, 1);
  } catch {
    return [];
  }
};

export const writeBag = (items: BagItem[]) => {
  // Hard cap: only ever persist a single item.
  localStorage.setItem(key(), JSON.stringify((items ?? []).filter(isValidItem).slice(0, 1)));
  window.dispatchEvent(new CustomEvent("roop:bag-updated"));
};

export type AddToBagResult =
  | { ok: true }
  | { ok: false; reason: "limit"; existing: BagItem };

/** Adds an item only when the bag is empty. */
export const addToBag = (item: BagItem): AddToBagResult => {
  const current = readBag();
  if (current.length > 0) {
    return { ok: false, reason: "limit", existing: current[0] };
  }
  writeBag([item]);
  return { ok: true };
};

/** Removes whatever is in the bag and puts `item` in its place. */
export const replaceBag = (item: BagItem) => {
  writeBag([item]);
};

export const removeFromBag = (id: string) => {
  writeBag(readBag().filter((i) => i.id !== id));
};

export const clearBag = () => writeBag([]);

export const bagCount = () => readBag().length;

