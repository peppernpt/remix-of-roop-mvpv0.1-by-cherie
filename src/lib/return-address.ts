// Store return address (customer-facing).
// The customer is responsible for shipping the item back to the store, so the
// address shown MUST always come from the vendor/store profile — never from the
// customer's own registered address.

export interface StoreReturnAddressSource {
  store_name?: string | null;
  store_address?: string | null;
  subdistrict?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

export const RETURN_ADDRESS_MISSING = "Store return address not added yet.";
export const RETURN_ADDRESS_MISSING_HINT =
  "Please confirm the return address with the store via LINE before payment.";
export const RETURN_FEE_NOTE =
  "The total shown here does not include the return delivery fee. You will need to pay the return delivery fee separately when sending the item back to the store.";
export const RETURN_FEE_SHORT = "Paid separately by customer";

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t && t !== "—" ? t : null;
};

/**
 * Formats the store return address, e.g.
 * "RentCHOM — Thonglor 123, Wattana, Bangkok, 10110".
 * Returns null when the store has no usable address parts.
 */
export const formatReturnAddress = (
  store: StoreReturnAddressSource | null | undefined,
): string | null => {
  if (!store) return null;
  const parts = [
    clean(store.store_address),
    clean(store.subdistrict),
    clean(store.city),
    clean(store.postal_code),
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  const name = clean(store.store_name);
  const line = parts.join(", ");
  return name ? `${name} — ${line}` : line;
};
