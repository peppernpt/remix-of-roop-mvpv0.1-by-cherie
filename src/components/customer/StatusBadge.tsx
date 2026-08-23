import { cn } from "@/lib/utils";

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
  | "cancelled";

const META: Record<BookingStatus, { label: string; cls: string }> = {
  pending_vendor_review: {
    label: "Pending Request",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  approved_waiting_payment: {
    label: "Awaiting payment",
    cls: "bg-blue-100 text-blue-800 border-blue-200",
  },
  payment_submitted: {
    label: "Payment submitted",
    cls: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  to_deliver: { label: "Preparing delivery", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  on_delivery: { label: "On delivery", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  on_rent: { label: "On rent", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  on_return: { label: "Returning", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  for_review: { label: "Return review", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Cancelled", cls: "bg-rose-100 text-rose-800 border-rose-200" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const meta = META[status as BookingStatus] ?? {
    label: status,
    cls: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
        meta.cls
      )}
    >
      {meta.label}
    </span>
  );
};

export default StatusBadge;
