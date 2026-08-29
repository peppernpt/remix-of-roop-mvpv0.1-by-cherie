import { formatDateForDatabase, formatDisplayDate } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, ShoppingBag, Info, ArrowLeft } from "lucide-react";
import CustomerLayout, { PageHero } from "@/components/customer/CustomerLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { readBag, removeFromBag, clearBag, BagItem } from "@/lib/bag-store";
import {
  deliveryMethodLabel,
  earliestStartDate,
  isValidRentalDuration,
  rentalDays,
  startOfDay,
  type DeliveryMethod,
  type Province,
} from "@/lib/booking-logic";
import { parseDatabaseDate } from "@/lib/date-utils";
import { findAvailableUnitForDateRange } from "@/lib/availability";
import { RequestPolicyModal } from "@/components/customer/RequestPolicyModal";
import {
  formatReturnAddress,
  RETURN_ADDRESS_MISSING,
  RETURN_ADDRESS_MISSING_HINT,
  RETURN_FEE_NOTE,
} from "@/lib/return-address";

const Bag = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<BagItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [returnAcknowledged, setReturnAcknowledged] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [returnAddress, setReturnAddress] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storePolicy, setStorePolicy] = useState<string | null>(null);
  const [storePolicyImages, setStorePolicyImages] = useState<string[]>([]);
  const [storePolicyAcknowledged, setStorePolicyAcknowledged] = useState(false);
  const [storePolicyLoaded, setStorePolicyLoaded] = useState(false);


  useEffect(() => {
    const refresh = () => setItems(readBag());
    // Re-read (and reset form state) whenever the authenticated user changes,
    // so a previous account's bag/promo code can never carry over.
    setPromoCode("");
    setPolicyAcknowledged(false);
    setReturnAcknowledged(false);
    setStorePolicyAcknowledged(false);
    refresh();
    window.addEventListener("roop:bag-updated", refresh);
    return () => window.removeEventListener("roop:bag-updated", refresh);
  }, [user?.id]);

  // Store return address comes ONLY from the vendor/store profile.
  const vendorId = items[0]?.vendorId ?? null;
  useEffect(() => {
    let cancelled = false;
    setReturnAddress(null);
    setStoreName(null);
    setStorePolicy(null);
    setStorePolicyImages([]);
    setStorePolicyAcknowledged(false);
    setStorePolicyLoaded(false);
    if (!vendorId) return;
    (async () => {
      const { data } = await supabase
        .from("vendors_public")
        .select(
          "store_name, store_address, subdistrict, city, postal_code, rental_details_policy, rental_policy_image_urls",
        )
        .eq("id", vendorId)
        .maybeSingle();
      if (cancelled) return;
      setReturnAddress(formatReturnAddress(data as any));
      setStoreName((data as any)?.store_name ?? null);
      setStorePolicy((data as any)?.rental_details_policy ?? null);
      setStorePolicyImages(((data as any)?.rental_policy_image_urls as string[] | null) ?? []);
      setStorePolicyLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const hasStorePolicy = Boolean(storePolicy?.trim()) || storePolicyImages.length > 0;


  const remove = (id: string) => removeFromBag(id);


  const subtotal = items.reduce((s, i) => s + i.rentalTotal, 0);
  const depositTotal = items.reduce((s, i) => s + i.depositTotal, 0);

  const submit = async () => {
    if (!user) return;
    if (submitting) return; // guard rapid double-clicks
    // MVP: exactly one item per rental request.
    const current = readBag();
    if (current.length === 0) {
      toast({
        title: "Your bag is empty",
        description: "Add one item before sending a request.",
      });
      return;
    }
    if (current.length !== 1 || items.length !== 1) {
      setItems(current.slice(0, 1));
      toast({
        title: "One item per rental request",
        description:
          "ROOP currently supports one item per rental request. Please keep only one item in your bag.",
        variant: "destructive",
      });
      return;
    }
    if (!policyAcknowledged) {
      toast({
        title: "Please agree to the request policy",
        description: "You must tick the checkbox before sending the request.",
      });
      return;
    }
    if (!returnAcknowledged) {
      toast({
        title: "Please confirm return responsibility",
        description:
          "You must confirm that you are responsible for returning the item and paying the return delivery fee.",
      });
      return;
    }
    if (hasStorePolicy && !storePolicyAcknowledged) {
      toast({
        title: "Please acknowledge the store’s rental policy",
        description: "Please acknowledge the store’s rental policy before sending your request.",
      });
      return;
    }


    setSubmitting(true);

    try {
      // Defensive: ensure profile row exists for this auth user (FK target)
      const { data: existingProfile, error: pSelErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!existingProfile) {
        const { error: pInsErr } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? null,
            role: "customer",
          },
          { onConflict: "id" }
        );
        if (pInsErr) throw pInsErr;
      }

      // MVP enforces single-vendor bag — vendorId comes straight from the booking page.
      const vendorId = items[0].vendorId;

      // Verify vendor still active
      const { data: vendorRow, error: vErr } = await supabase
        .from("vendors_public")
        .select("id, is_active")
        .eq("id", vendorId)
        .maybeSingle();
      if (vErr) throw vErr;
      if (!vendorRow || !vendorRow.is_active) {
        toast({
          title: "Vendor unavailable",
          description: "This store isn't accepting bookings right now.",
        });
        setSubmitting(false);
        return;
      }


      // Reserve one available unit per item BEFORE creating the booking.
      // Final server-backed availability re-check (date overlap + buffers), so a
      // stale calendar can never create an overlapping request.
      const reservations: Array<{
        item: BagItem;
        unitId: string;
      }> = [];
      const takenUnitIds = new Set<string>();
      for (const i of items) {
        const { data: unitRows, error: uErr } = await supabase
          .from("product_units_public")
          .select("id")
          .eq("product_id", i.productId);

        if (uErr) throw uErr;
        const units = (unitRows ?? [])
          .filter((u) => !takenUnitIds.has(u.id))
          .map((u) => ({ id: u.id, product_id: i.productId }));

        const { data: blockedRows, error: blockErr } = await supabase.rpc(
          "get_product_unit_blocked_bookings",
          { _product_id: i.productId },
        );
        if (blockErr) throw blockErr;
        const existingBookings = (blockedRows ?? []).map((r: any) => ({
          id: r.booking_id,
          status: r.status,
          rental_start: r.rental_start,
          rental_end: r.rental_end,
          delivery_method: r.delivery_method,
          province: r.delivery_province,
          product_unit_ids: [r.product_unit_id],
        }));

        // Prefer the unit picked on the product page, but only if it is still free.
        const preferred =
          i.productUnitId && units.some((u) => u.id === i.productUnitId)
            ? units.filter((u) => u.id === i.productUnitId)
            : units;

        const unit =
          findAvailableUnitForDateRange({
            productId: i.productId,
            selectedStartDate: i.startDate,
            selectedEndDate: i.endDate,
            productUnits: preferred,
            existingBookings,
            candidateDeliveryMethod: i.deliveryMethod,
            candidateProvince: i.province,
          }) ??
          findAvailableUnitForDateRange({
            productId: i.productId,
            selectedStartDate: i.startDate,
            selectedEndDate: i.endDate,
            productUnits: units,
            existingBookings,
            candidateDeliveryMethod: i.deliveryMethod,
            candidateProvince: i.province,
          });

        if (import.meta.env.DEV) {
          console.log("[availability] bag re-check", {
            productId: i.productId,
            activeUnitIds: units.map((u) => u.id),
            selected: { start: i.startDate, end: i.endDate },
            existingBookings,
            assignedUnit: unit?.id ?? null,
          });
        }

        if (!unit) {
          toast({
            title: "Dates unavailable",
            description:
              "This item is unavailable for the selected dates. Please choose another date range.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        takenUnitIds.add(unit.id);
        reservations.push({ item: i, unitId: unit.id });
      }

      // Rental window covering all items
      const startISO = items.reduce(
        (m, i) => (i.startDate < m ? i.startDate : m),
        items[0].startDate
      );
      const endISO = items.reduce(
        (m, i) => (i.endDate > m ? i.endDate : m),
        items[0].endDate
      );

      const bookingPayload = {
        customer_id: user.id,
        vendor_id: vendorId,
        rental_start: formatDateForDatabase(startISO),
        rental_end: formatDateForDatabase(endISO),
        rental_total: subtotal,
        deposit_total: depositTotal,
        delivery_fee: 0,
        grand_total: subtotal + depositTotal,
        status: "pending_vendor_review",
        promo_code: promoCode.trim() ? promoCode.trim() : null,
        delivery_method: items[0]?.deliveryMethod ?? null,
        delivery_address: items[0]?.address?.trim() ? items[0].address.trim() : null,
        delivery_province: items[0]?.province?.trim() ? items[0].province.trim() : null,
        policy_acknowledged: true,
        policy_acknowledged_at: new Date().toISOString(),
        return_policy_acknowledged: true,
        return_policy_acknowledged_at: new Date().toISOString(),
        return_address_snapshot: returnAddress,
        store_policy_acknowledged: hasStorePolicy ? true : false,
        store_policy_acknowledged_at: hasStorePolicy ? new Date().toISOString() : null,
        store_policy_snapshot: storePolicy?.trim() ? storePolicy.trim() : null,
        store_policy_image_urls_snapshot: storePolicyImages.length ? storePolicyImages : null,



        notes: items
          .map(
            (i) =>
              `${i.productName} (${i.size}/${i.color}) — ${formatDisplayDate(i.startDate)} → ${formatDisplayDate(
                i.endDate
              )} via ${deliveryMethodLabel(i.deliveryMethod)}. Address: ${i.address}, ${i.province}.`
          )
          .join("\n"),
      };

      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select("id, rental_start, rental_end")
        .single();
      if (bErr) throw bErr;


      // Insert booking_items. If any item fails (validation trigger, race on
      // the unit, network), delete the just-created booking so no orphaned
      // itemless request reaches the vendor.
      try {
        for (const r of reservations) {
          const { error: biErr } = await supabase.from("booking_items").insert({
            booking_id: booking.id,
            product_id: r.item.productId,
            product_unit_id: r.unitId,
            rental_price: r.item.rentalTotal,
            deposit_amount: r.item.depositTotal,
          });
          if (biErr) throw biErr;
        }
      } catch (itemErr) {
        await supabase.from("booking_items").delete().eq("booking_id", booking.id);
        await supabase.from("bookings").delete().eq("id", booking.id);
        throw itemErr;
      }

      // Advisory unit flag only — availability is date-based, so a failure
      // here must not block the request.
      const { error: unitErr } = await supabase
        .from("product_units")
        .update({ status: "reserved" })
        .in("id", reservations.map((r) => r.unitId));
      if (unitErr && import.meta.env.DEV) {
        console.warn("[booking] unit status update skipped:", unitErr.message);
      }

      clearBag();
      navigate(`/order-sent/${booking.id}`, { replace: true });
    } catch (err: any) {
      toast({
        title: "Couldn't send request",
        description: err.message ?? "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const lastProductId = items.length ? items[items.length - 1].productId : null;
  const backTo = lastProductId ? `/booking/${lastProductId}` : "/explore";

  return (
    <CustomerLayout hero={<PageHero title="Your Bag" subtitle="Review your items before sending the request" />}>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to product"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center max-w-md mx-auto">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-medium mb-1">Your bag is empty</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Browse the catalogue and add a piece to get started.
          </p>
          <Button asChild>
            <Link to="/explore">Browse pieces</Link>
          </Button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <section className="space-y-3">
            {items.map((i) => (
              <article
                key={i.id}
                className="bg-card border border-border rounded-2xl p-4 flex gap-4"
              >
                <div className="w-24 h-32 rounded-lg bg-muted overflow-hidden shrink-0">
                  <img src={i.productImage} alt={i.productName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{i.vendorName}</p>
                  <h3 className="font-medium text-foreground">{i.productName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {i.size} · {i.color}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDisplayDate(i.startDate)} → {formatDisplayDate(i.endDate)} · {i.days}{" "}
                    {i.days === 1 ? "day" : "days"} rental
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deliveryMethodLabel(i.deliveryMethod)} · {i.province}
                  </p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => remove(i.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <p className="font-medium text-foreground text-sm">
                    ฿{i.rentalTotal.toLocaleString()}
                  </p>
                </div>
              </article>
            ))}
          </section>

          <aside className="lg:sticky lg:top-24 bg-card border border-border rounded-2xl p-6">
            <h2 className="text-base font-medium mb-4">Order summary</h2>
            <div className="space-y-2 text-sm">
              <Row label="Rental subtotal" value={subtotal} />
              <Row label="Refundable deposit" value={depositTotal} muted />
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="font-medium">Total today</span>
                <span className="text-lg font-semibold">
                  ฿{(subtotal + depositTotal).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-[11px] font-bold text-red-500 mt-3 flex items-start gap-1.5">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              Delivery fee is confirmed by the vendor after they review your request. Payment is arranged via chat.
              Total shown does not include the return delivery fee. Customers are responsible for return shipping.
            </p>
            <div className="mt-5">
              <label htmlFor="promo-code" className="block text-sm font-medium mb-1.5">
                Promo Code
              </label>
              <input
                id="promo-code"
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter promo code"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                If you have a promo code, enter it here.
              </p>
            </div>

            <section className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="text-sm font-medium mb-1.5">Return responsibility</h3>
              <p className="text-xs text-muted-foreground">
                You are responsible for sending the item back to the store by the return date.
              </p>
              <div className="mt-3">
                <p className="text-xs font-medium text-foreground">Preferred Address</p>
                {returnAddress ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{returnAddress}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mt-0.5">{RETURN_ADDRESS_MISSING}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {RETURN_ADDRESS_MISSING_HINT}
                    </p>
                  </>
                )}
              </div>
              <p className="text-xs font-medium text-red-500 mt-3">{RETURN_FEE_NOTE}</p>
            </section>

            {hasStorePolicy && (
              <section className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
                <h3 className="text-sm font-medium mb-1">Store Rental Details &amp; Policy</h3>
                <p className="text-xs text-muted-foreground">
                  Please review the store’s rental rules before sending your request.
                </p>
                {storeName && (
                  <p className="text-xs font-medium text-foreground mt-2">{storeName}</p>
                )}
                {storePolicy?.trim() && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line max-h-48 overflow-y-auto">
                    {storePolicy}
                  </p>
                )}
                {storePolicyImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {storePolicyImages.map((url, idx) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`${storeName ?? "Store"} rental policy ${idx + 1}`}
                          loading="lazy"
                          className="h-20 w-full rounded-lg object-cover border border-border"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-start gap-3">
                  <input
                    id="store-policy-acknowledge"
                    type="checkbox"
                    checked={storePolicyAcknowledged}
                    onChange={(e) => setStorePolicyAcknowledged(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                  />
                  <label htmlFor="store-policy-acknowledge" className="text-sm leading-relaxed cursor-pointer">
                    I have read and understand {storeName ?? "the store"}’s Rental Details &amp; Policy.
                  </label>
                </div>
              </section>
            )}

            <div className="mt-5 flex items-start gap-3">

              <input
                id="policy-acknowledge"
                type="checkbox"
                checked={policyAcknowledged}
                onChange={(e) => setPolicyAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              <div className="text-sm leading-relaxed">
                <label htmlFor="policy-acknowledge" className="cursor-pointer">
                  I understand and agree to ROOP’s request policy.
                </label>
                <button
                  type="button"
                  onClick={() => setPolicyModalOpen(true)}
                  className="block text-sm font-bold text-red-500 hover:underline mt-0.5"
                >
                  View request policy
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <input
                id="return-acknowledge"
                type="checkbox"
                checked={returnAcknowledged}
                onChange={(e) => setReturnAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              <label
                htmlFor="return-acknowledge"
                className="text-sm leading-relaxed cursor-pointer"
              >
                I understand that I am responsible for returning the item to the store, and that the
                return delivery fee is not included in the total shown here.
              </label>
            </div>

            <Button
              onClick={submit}
              disabled={
                submitting || !policyAcknowledged || !returnAcknowledged || (hasStorePolicy && !storePolicyAcknowledged)
              }
              className="w-full h-12 mt-5"
            >
              {submitting ? "Sending request…" : "Send order request"}
            </Button>

          </aside>
        </div>
      )}
      <RequestPolicyModal open={policyModalOpen} onOpenChange={setPolicyModalOpen} />
    </CustomerLayout>
  );
};

const Row = ({ label, value, muted }: { label: string; value: number; muted?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
    <span className={muted ? "text-muted-foreground" : ""}>฿{value.toLocaleString()}</span>
  </div>
);

export default Bag;
