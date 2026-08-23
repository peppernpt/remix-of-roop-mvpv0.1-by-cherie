import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentCalloutProps {
  bookingId: string;
  status: string;
  /** "full" fills the card edge-to-edge (Tracking); "compact" sits inline (Home) */
  variant?: "full" | "compact";
}

const PaymentCallout = ({
  bookingId,
  status,
  variant = "full",
}: PaymentCalloutProps) => {
  const containerCls =
    variant === "full"
      ? "mt-3 -mx-1 -mb-1"
      : "mt-2";

  if (status === "approved_waiting_payment") {
    const isCompact = variant === "compact";
    const message = isCompact
      ? "Upload your slip to confirm this rental."
      : "Your booking has been approved. Please upload your payment slip to confirm this rental.";
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "rounded-xl bg-amber-50 border border-amber-200",
          isCompact ? "p-2 mt-2" : "p-3",
          containerCls,
        )}
      >
        <div className={isCompact ? "flex items-center gap-2 mb-2" : "flex items-start gap-2 mb-2.5"}>
          <AlertCircle className={cn("text-amber-600 shrink-0", isCompact ? "w-3.5 h-3.5" : "w-4 h-4 mt-0.5")} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-900">Payment required</p>
            <p className="text-[11px] text-amber-800/80 mt-0.5">{message}</p>
          </div>
        </div>
        <Link
          to={`/booking-payment/${bookingId}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center justify-center gap-1.5 w-full rounded-lg bg-black text-white font-medium hover:bg-black/90 transition-colors",
            isCompact ? "text-xs px-3 py-2" : "text-sm px-4 py-2.5",
          )}
        >
          Pay now
          <ArrowRight className={cn(isCompact ? "w-3 h-3" : "w-4 h-4")} />
        </Link>
      </div>
    );
  }

  if (status === "payment_submitted") {
    const isCompact = variant === "compact";
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "rounded-xl bg-sky-50 border border-sky-200",
          isCompact ? "p-2 mt-2 flex items-center gap-2" : "p-3 flex items-start gap-2",
        )}
      >
        <AlertCircle className={cn("text-sky-600 shrink-0", isCompact ? "w-3.5 h-3.5" : "w-4 h-4 mt-0.5")} />
        <p className="text-[11px] text-sky-800">
          Payment slip submitted. Waiting for store confirmation.
        </p>
      </div>
    );
  }

  return null;
};

export default PaymentCallout;
