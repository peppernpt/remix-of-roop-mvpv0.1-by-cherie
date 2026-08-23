// Booking lifecycle helpers for the vendor portal.

export type BookingStatus =
  | "pending_vendor_review"
  | "approved_waiting_payment"
  | "payment_submitted"
  | "paid"
  | "to_deliver"
  | "on_delivery"
  | "on_rent"
  | "on_return"
  | "for_review"
  | "completed"
  | "cancelled"
  | "rejected";

export const BOOKING_STATUSES: BookingStatus[] = [
  "pending_vendor_review",
  "approved_waiting_payment",
  "payment_submitted",
  "paid",
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
  "for_review",
  "completed",
  "cancelled",
];

// Vendor-facing label for each booking status. Each status shows its precise
// step (no "On Pending" collapsing) so vendors know exactly what to do next.
export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_vendor_review: "Pending Request",
  approved_waiting_payment: "Waiting Payment",
  payment_submitted: "Payment Submitted",
  paid: "Payment Confirmed",
  to_deliver: "To Deliver",
  on_delivery: "On Delivery",
  on_rent: "On Rent",
  on_return: "On Return",
  for_review: "For Review",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

// Detailed sub-status (vendor action context) — used inside the Order Detail
// popup subtitle.
export const STATUS_DETAIL_LABELS: Record<BookingStatus, string> = {
  pending_vendor_review: "Pending Request",
  approved_waiting_payment: "Waiting Payment",
  payment_submitted: "Payment Submitted",
  paid: "Payment Confirmed",
  to_deliver: "To Deliver",
  on_delivery: "On Delivery",
  on_rent: "On Rent",
  on_return: "On Return",
  for_review: "For Review",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

export const STATUS_TONES: Record<BookingStatus, string> = {
  pending_vendor_review: "bg-amber-50 text-amber-700 border-amber-200",
  approved_waiting_payment: "bg-amber-50 text-amber-700 border-amber-200",
  payment_submitted: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-amber-50 text-amber-700 border-amber-200",
  to_deliver: "bg-indigo-50 text-indigo-700 border-indigo-200",
  on_delivery: "bg-sky-50 text-sky-700 border-sky-200",
  on_rent: "bg-violet-50 text-violet-700 border-violet-200",
  on_return: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  for_review: "bg-rose-50 text-rose-700 border-rose-200",
};

// What status do the linked product_units take when the booking moves into this state?
// Returns null when units shouldn't change. Booking statuses (e.g. "paid",
// "approved_waiting_payment") never map onto product_units.status — units stay
// "reserved" until the rental physically progresses.
export const unitStatusForBooking = (s: BookingStatus): string | null => {
  switch (s) {
    case "pending_vendor_review":
    case "approved_waiting_payment":
    case "payment_submitted":
    case "paid":
      return "reserved";
    case "to_deliver":
      return "to_deliver";
    case "on_delivery":
      return "on_delivery";
    case "on_rent":
      return "on_rent";
    case "on_return":
      return "on_return";
    case "for_review":
      return "for_review";
    case "completed":
      return null;
    case "cancelled":
      return "available";
    default:
      return null;
  }
};

// Allowed forward transitions (linear lifecycle + cancel branch).
export const nextActions = (s: BookingStatus): Array<{ to: BookingStatus; label: string; tone?: "primary" | "destructive" }> => {
  switch (s) {
    case "pending_vendor_review":
      return [
        { to: "approved_waiting_payment", label: "Approve Order", tone: "primary" },
        { to: "cancelled", label: "Reject Order", tone: "destructive" },
      ];
    case "approved_waiting_payment":
      // Awaiting customer payment — vendor may still cancel the request
      return [
        { to: "cancelled", label: "Cancel Request", tone: "destructive" },
      ];
    case "payment_submitted":
      // Accepting the slip moves the order straight into the To Deliver stage
      // so the badge, tab and next action stay consistent.
      return [
        { to: "to_deliver", label: "Payment Accepted", tone: "primary" },
        { to: "approved_waiting_payment", label: "Reject Payment", tone: "destructive" },
      ];
    case "paid":
      // Legacy rows that were confirmed before the direct transition existed.
      return [{ to: "to_deliver", label: "Move to To Deliver", tone: "primary" }];
    case "to_deliver":
      return [{ to: "on_delivery", label: "Move to On Delivery", tone: "primary" }];
    case "on_delivery":
      return [{ to: "on_rent", label: "Move to On Rent", tone: "primary" }];
    case "on_rent":
      return [{ to: "on_return", label: "Move to On Return", tone: "primary" }];
    case "on_return":
      return [{ to: "for_review", label: "Move to For Review", tone: "primary" }];
    default:
      return [];
  }
};

export const isTerminal = (s: BookingStatus) => s === "completed" || s === "cancelled";

// Single source of truth for the vendor's primary "next step" button.
// Used by Dashboard, Transactions and Inventory order modals.
export type VendorNextAction = {
  label: string;
  nextStatus: BookingStatus;
  show: boolean;
  requiresValidation: "delivery_fee" | "payment_slip" | null;
};

export const getVendorNextAction = (s: BookingStatus): VendorNextAction | null => {
  const primary = nextActions(s).find((a) => a.tone !== "destructive");
  if (!primary) return null;
  const requiresValidation =
    s === "pending_vendor_review"
      ? "delivery_fee"
      : s === "payment_submitted"
        ? "payment_slip"
        : null;
  return { label: primary.label, nextStatus: primary.to, show: true, requiresValidation };
};

// ---------------------------------------------------------------------------
// Limited vendor rollback (operational stages only)
//
// Vendors sometimes click the next-stage button by accident. They may step back
// one operational stage, but NEVER back into a payment stage
// (pending_vendor_review / approved_waiting_payment / payment_submitted / paid).
// All of these statuses keep blocking calendar availability, so stepping between
// them never makes an item bookable again.
// ---------------------------------------------------------------------------

export type RollbackAction = { to: BookingStatus; label: string };

// `hasReviewUnits` marks a completed booking that is still in the "For Review"
// stage (units awaiting inspection). A completed booking with nothing left to
// review is final and cannot be rolled back.
export const getVendorRollbackAction = (
  s: BookingStatus,
  hasReviewUnits = false,
): RollbackAction | null => {
  switch (s) {
    case "on_delivery":
      return { to: "to_deliver", label: "Move back to To Deliver" };
    case "on_rent":
      return { to: "on_delivery", label: "Move back to On Delivery" };
    case "on_return":
      return { to: "on_rent", label: "Move back to On Rent" };
    case "for_review":
      return { to: "on_return", label: "Move back to On Return" };
    case "completed":
      return hasReviewUnits ? { to: "on_return", label: "Move back to On Return" } : null;
    default:
      return null;
  }
};

// Statuses whose forward move needs a confirmation dialog (post-payment ops).
export const requiresForwardConfirmation = (from: BookingStatus, to: BookingStatus) =>
  (["to_deliver", "on_delivery", "on_rent", "on_return", "for_review"] as BookingStatus[]).includes(from) &&
  (["on_delivery", "on_rent", "on_return", "for_review", "completed"] as BookingStatus[]).includes(to);

// Human label used inside confirmation copy ("Move this order to On Delivery?").
export const stageLabel = (s: BookingStatus, hasReviewUnits = false) =>
  s === "completed" && hasReviewUnits ? "For Review" : STATUS_LABELS[s];
