import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Copy, Check } from "lucide-react";
import CustomerLayout from "@/components/customer/CustomerLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatBookingReference } from "@/lib/booking-reference";

const OrderRequestSent = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [productName, setProductName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lineCopied, setLineCopied] = useState(false);
  const [storeLineId, setStoreLineId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  /** null = still checking, false = not this user's booking. */
  const [owned, setOwned] = useState<boolean | null>(null);

  useEffect(() => {
    // Always reset before re-checking so another user's confirmation can never
    // stay on screen after an account switch.
    setProductName(null);
    setStoreLineId(null);
    setStoreName(null);
    setOwned(null);
    if (authLoading) return;
    if (!id || !user) {
      setOwned(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Ownership check: the booking must belong to the current auth user.
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, vendor_id, customer_id")
        .eq("id", id)
        .eq("customer_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!booking) {
        setOwned(false);
        return;
      }
      setOwned(true);

      const { data: item } = await supabase
        .from("booking_items")
        .select("products(name)")
        .eq("booking_id", id)
        .limit(1)
        .maybeSingle();
      if (!cancelled && item && (item as any).products?.name) {
        setProductName((item as any).products.name);
      }

      if (!booking.vendor_id) return;
      const { data: vendor } = await supabase
        .from("vendors")
        .select("store_name, line_id")
        .eq("id", booking.vendor_id)
        .maybeSingle();
      if (!cancelled && vendor) {
        setStoreName((vendor as any).store_name ?? null);
        setStoreLineId(((vendor as any).line_id ?? "").trim() || null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id, authLoading]);




  const reference = formatBookingReference(id);

  const message = useMemo(() => {
    if (productName) {
      return `Hi, I requested ${productName} from ROOP. My booking reference is ${reference}.`;
    }
    return `Hi, I requested an item from ROOP. My booking reference is ${reference}.`;
  }, [productName, reference]);

  const copyMessage = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore unsupported environments
      setCopied(false);
    }
  };

  const copyLineId = async () => {
    if (!storeLineId) return;
    try {
      await navigator.clipboard.writeText(storeLineId);
      setLineCopied(true);
      setTimeout(() => setLineCopied(false), 2000);
    } catch {
      setLineCopied(false);
    }
  };

  if (owned === false) {
    return (
      <CustomerLayout>
        <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 md:p-10 text-center">
          <h1 className="text-xl font-medium mb-2">Request not found</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This request isn’t available for your account.
          </p>
          <Button asChild>
            <Link to="/tracking">Go to tracking</Link>
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  return (

    <CustomerLayout>
      <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 md:p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-medium mb-2">Order request sent!</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your rental request has been submitted. The vendor will review it and respond shortly.
        </p>

        <div className="rounded-xl bg-muted/60 border border-border p-5 text-left mb-6">
          <p className="text-sm font-medium text-foreground mb-3">What happens next</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-foreground">1.</span> Copy the message below and send it to the store on LINE.</li>
            <li className="flex gap-2"><span className="text-foreground">2.</span> The vendor reviews your order details.</li>
            <li className="flex gap-2"><span className="text-foreground">3.</span> The vendor confirms the delivery fee with you via chat.</li>
            <li className="flex gap-2"><span className="text-foreground">4.</span> You pay externally and the vendor confirms payment in ROOP.</li>
            <li className="flex gap-2"><span className="text-foreground">5.</span> Track everything from the Tracking page.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-border p-4 text-left mb-6 bg-background">
          <p className="text-sm font-medium text-foreground mb-1">Return reminder</p>
          <p className="text-sm text-muted-foreground">
            When your rental ends, send the item back to the store using the return address shown in
            Tracking. Return delivery cost is paid separately by you.
          </p>
        </div>


        {id && (
          <div className="rounded-xl border border-border p-5 text-left mb-6 bg-background">
            <p className="text-sm font-medium text-foreground mb-2">Next step: Message the store on LINE</p>
            <p className="text-sm text-muted-foreground mb-3">
              Please send this message to the store on LINE so they can identify your request and confirm your order faster.
            </p>
            <div className="rounded-lg bg-muted/60 border border-border p-3 mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Store LINE ID{storeName ? ` · ${storeName}` : ""}
                </p>
                <p className="text-sm font-medium text-foreground break-all">
                  {storeLineId ?? "Not added yet"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {storeLineId
                    ? "Please message this LINE account and send the copied request message."
                    : "The store has not added a LINE ID yet. You can still track your request from the Tracking page."}
                </p>
              </div>
              {storeLineId && (
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={copyLineId}>
                  {lineCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-1 text-xs">{lineCopied ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>
            <div className="rounded-lg bg-muted/60 border border-border p-3 mb-3">

              <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
            </div>
            <Button
              onClick={copyMessage}
              variant="outline"
              className="h-10 px-4"
              disabled={!message}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Message copied.
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy message
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">
              Reference: <span className="font-mono">{reference}</span>
            </p>
          </div>
        )}

        <div className="flex justify-center">
          <Button asChild className="h-11">
            <Link to="/tracking">Go to tracking</Link>
          </Button>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default OrderRequestSent;
