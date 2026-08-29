// Lightweight cross-page sync bus for booking / inventory changes.
// Pages subscribe to refetch their data after lifecycle updates. When Postgres
// realtime is enabled for the bookings table (see the hardening migration),
// startBookingsRealtime() pushes cross-user changes into the same bus, so a
// vendor sees new requests and a customer sees approvals without refreshing.

import { supabase } from "@/integrations/supabase/client";

const EVENT = "roop:bookings-changed";

export const emitBookingsChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
};

export const onBookingsChanged = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  // Also refresh when the tab regains focus (covers cross-tab navigation).
  const onFocus = () => cb();
  const onVisible = () => {
    if (document.visibilityState === "visible") cb();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
  };
};

/**
 * Subscribe to live booking changes for one side of the marketplace.
 * `filter` example: `customer_id=eq.<uuid>` or `vendor_id=eq.<uuid>`.
 * Returns an unsubscribe function. Safe when realtime is not enabled for the
 * table: the channel simply receives no events and the focus/refetch behaviour
 * of the bus remains the fallback.
 */
export const startBookingsRealtime = (channelKey: string, filter: string) => {
  try {
    const channel = supabase
      .channel(`bookings-live-${channelKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter },
        () => emitBookingsChanged(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
};
