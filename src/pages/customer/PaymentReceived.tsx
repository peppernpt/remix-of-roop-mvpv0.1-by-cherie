import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import CustomerLayout from "@/components/customer/CustomerLayout";
import { Button } from "@/components/ui/button";
import { formatBookingReference } from "@/lib/booking-reference";

const PaymentReceived = () => {
  const { id } = useParams();
  return (
    <CustomerLayout>
      <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 md:p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-medium mb-2">Payment received!</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your rental is now being prepared for delivery. You can follow every step on the Tracking page.
        </p>

        <div className="rounded-xl bg-muted/60 border border-border p-5 text-left mb-6">
          <p className="text-sm font-medium text-foreground mb-3">What happens next</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-foreground">1.</span> The vendor prepares and ships your item.</li>
            <li className="flex gap-2"><span className="text-foreground">2.</span> Tracking number and dates appear in Tracking.</li>
            <li className="flex gap-2"><span className="text-foreground">3.</span> For rental issues, contact your vendor directly.</li>
            <li className="flex gap-2"><span className="text-foreground">4.</span> For account issues, reach ROOP customer service.</li>
          </ul>
        </div>

        <Button asChild className="h-11 w-full sm:w-auto">
          <Link to="/tracking">Go to tracking</Link>
        </Button>
        {id && (
          <p className="text-[11px] text-muted-foreground mt-5">
            Reference: <span className="font-mono">{formatBookingReference(id)}</span>
          </p>
        )}
      </div>
    </CustomerLayout>
  );
};

export default PaymentReceived;
