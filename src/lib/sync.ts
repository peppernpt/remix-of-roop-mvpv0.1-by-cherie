// Lightweight cross-page sync bus for booking / inventory changes.
// Pages can subscribe to refetch their data after lifecycle updates,
// without needing Postgres realtime.

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
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") cb();
  });
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("focus", onFocus);
  };
};
