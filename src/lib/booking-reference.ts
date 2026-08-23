export const formatBookingReference = (bookingId?: string | null): string => {
  if (!bookingId) return "#------";
  return `#${bookingId.slice(0, 6).toUpperCase()}`;
};
