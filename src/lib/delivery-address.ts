// Order-specific delivery address resolution.
// Delivery Details must ONLY ever show the booking-level snapshot saved at
// request time. The customer's registered address is a separate concept and is
// never used as a fallback here (that was confusing and looked like stale data).

export interface RegisteredAddress {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t && t !== "—" ? t : null;
};

export const formatRegisteredAddress = (
  addr: RegisteredAddress | null | undefined,
): string =>
  addr
    ? [
        clean(addr.address_line1),
        clean(addr.address_line2),
        clean(addr.city) ?? "City not added",
        clean(addr.state),
        clean(addr.postal_code),
        clean(addr.country),
      ]
        .filter(Boolean)
        .join(", ")
    : "No address on file";

export const NO_ORDER_ADDRESS = "No delivery address saved for this order.";

/**
 * Returns the booking's own delivery address, or null when the booking has
 * none saved (e.g. bookings created before the field existed).
 * Never falls back to any other source.
 */
export const resolveOrderDeliveryAddress = (
  bookingDeliveryAddress: string | null | undefined,
): string | null => {
  const snapshot = (bookingDeliveryAddress ?? "").trim();
  return snapshot ? snapshot : null;
};
