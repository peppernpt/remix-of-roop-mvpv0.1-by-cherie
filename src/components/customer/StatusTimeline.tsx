import { Check, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Customer-facing order journey. Collapses the internal status machine into
 * the steps a renter actually experiences, with the current one highlighted.
 */

const STEPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "requested", label: "Request sent", statuses: ["pending_vendor_review"] },
  { key: "approved", label: "Approved by store", statuses: ["approved_waiting_payment"] },
  { key: "payment", label: "Payment", statuses: ["payment_submitted", "paid"] },
  { key: "preparing", label: "Preparing your item", statuses: ["to_deliver"] },
  { key: "delivery", label: "On its way", statuses: ["on_delivery"] },
  { key: "rent", label: "Enjoy your rental", statuses: ["on_rent"] },
  { key: "return", label: "Return & inspection", statuses: ["on_return", "for_review"] },
  { key: "done", label: "Completed", statuses: ["completed"] },
];

const stepIndexFor = (status: string): number =>
  STEPS.findIndex((s) => s.statuses.includes(status));

const StatusTimeline = ({ status }: { status: string }) => {
  if (status === "cancelled" || status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
        <XCircle className="w-4 h-4 shrink-0" />
        {status === "rejected"
          ? "The store declined this request. Your dates are released — nothing was charged."
          : "This order was cancelled. If you had already paid, the store will arrange your refund."}
      </div>
    );
  }

  const current = stepIndexFor(status);
  if (current < 0) return null;

  return (
    <ol className="mt-2 space-y-0" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i < current || status === "completed";
        const active = i === current && status !== "completed";
        const last = i === STEPS.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-0.5">
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[9px] top-5 bottom-0 w-px",
                  done ? "bg-foreground" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border text-[10px]",
                done
                  ? "bg-foreground border-foreground text-background"
                  : active
                    ? "border-foreground text-foreground"
                    : "border-border text-transparent",
              )}
            >
              {done ? <Check className="w-3 h-3" /> : <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-foreground" : "bg-transparent")} />}
            </span>
            <span
              className={cn(
                "pb-3 text-sm leading-5",
                active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default StatusTimeline;
