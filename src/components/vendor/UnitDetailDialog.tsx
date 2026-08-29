import { deliveryMethodLabel } from "@/lib/booking-logic";
import { buildSku } from "@/lib/sku";
import { getStartingPrice, normalizeCustomRates, type CustomRentalRate } from "@/lib/pricing";
import { parseDatabaseDate, calculateRentalDays, formatActualReturnDate } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Calendar, Package2, ArrowLeft, MessageCircle, Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { emitBookingsChanged } from "@/lib/sync";
import { resolveOrderDeliveryAddress, formatRegisteredAddress, NO_ORDER_ADDRESS } from "@/lib/delivery-address";
import { formatBookingReference } from "@/lib/booking-reference";
import {
  checkUnitOccupancy,
  isPhysicalFulfilmentStatus,
  UNIT_OCCUPIED_MESSAGE,
} from "@/lib/unit-occupancy";

interface Props {
  unitId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface UnitDetail {
  id: string;
  serial_id: string;
  status: string; // raw product_units.status
  displayStatus: string; // derived from booking + unit
  current_booking_id: string | null;
  product: {
    id: string;
    name: string;
    daily_rental_rate: number;
    image: string | null;
    sku: string;
    customRates: CustomRentalRate[];
  };
  booking: {
    id: string;
    status: string;
    rental_start: string;
    rental_end: string;
    grand_total: number;
    rental_total: number;
    deposit_total: number;
    delivery_fee: number;
    rental_price: number;
    promo_code: string | null;
    delivery_address: string | null;
    delivery_province: string | null;
    delivery_method: string | null;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string;
      lineId?: string;
      instagram?: string;
    };
    address: {
      address_line1: string;
      address_line2: string | null;
      city: string;
      state: string | null;
      postal_code: string | null;
      country: string;
    } | null;
  } | null;
}

const PENDING_BOOKING_STATUSES = new Set([
  "pending_vendor_review",
  "approved_waiting_payment",
  "payment_submitted",
  "paid",
]);
const ACTIVE_BOOKING_STATUSES = new Set([
  ...PENDING_BOOKING_STATUSES,
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
]);

const deriveDisplayStatus = (
  unitStatus: string,
  bookingStatus: string | null,
): string => {
  if (bookingStatus === "pending_vendor_review") return "pending_request";
  if (bookingStatus === "approved_waiting_payment") return "waiting_payment";
  if (bookingStatus === "payment_submitted") return "payment_submitted";
  if (bookingStatus === "paid") return "payment_confirmed";
  if (bookingStatus === "to_deliver") return "to_deliver";
  if (bookingStatus === "on_delivery") return "on_delivery";
  if (bookingStatus === "on_rent") return "on_rent";
  if (bookingStatus === "on_return") return "on_return";
  if (bookingStatus === "for_review") return "for_review";
  if (bookingStatus === "completed" && unitStatus === "for_review") return "for_review";
  if (unitStatus === "for_review") return "for_review";
  if (unitStatus === "available") return "available";
  return unitStatus || "unavailable";
};


const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) =>
  parseDatabaseDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const dayDiff = (a: string, b: string) =>
  Math.max(1, calculateRentalDays(a, b));
const skuOf = (p: any) => (p?.sku?.trim() || (p ? buildSku(p) : "—"));

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  available: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Available" },
  pending_request: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Pending Request" },
  waiting_payment: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Waiting Payment" },
  payment_submitted: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Payment Submitted" },
  payment_confirmed: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Payment Confirmed" },
  reserved: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Reserved" },
  to_deliver: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", label: "To Deliver" },
  on_delivery: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "On Delivery" },
  on_rent: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "On Rent" },
  on_return: { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200", label: "On Return" },
  for_review: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200", label: "For Review" },
  unavailable: { dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 border-zinc-200", label: "Unavailable" },
};

const StatusPill = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] ?? { dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 border-zinc-200", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border", s.badge)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
};

// status -> { label, nextUnit, nextBooking, clearBooking }
const TRANSITIONS: Record<
  string,
  { label: string; nextUnit: string; nextBooking?: string; clearBooking?: boolean } | null
> = {
  reserved: { label: "Move to To Deliver", nextUnit: "to_deliver", nextBooking: "to_deliver" },
  pending_request: null,
  waiting_payment: null,
  payment_submitted: { label: "Payment Accepted", nextUnit: "to_deliver", nextBooking: "to_deliver" },
  payment_confirmed: { label: "Move to To Deliver", nextUnit: "to_deliver", nextBooking: "to_deliver" },
  to_deliver: { label: "Move to On Delivery", nextUnit: "on_delivery", nextBooking: "on_delivery" },
  on_delivery: { label: "Move to On Rent", nextUnit: "on_rent", nextBooking: "on_rent" },
  on_rent: { label: "Move to On Return", nextUnit: "on_return", nextBooking: "on_return" },
  on_return: { label: "Move to For Review", nextUnit: "for_review", nextBooking: "for_review" },
  // Return inspection (condition + notes) is mandatory and lives in the order
  // view — no shortcut from the unit dialog may skip it.
  for_review: null,
  available: null,
};

const FOR_REVIEW_HINT =
  "Complete the return inspection from Transactions \u2192 open the order \u2192 Return Inspection. The item is republished there after its condition is recorded.";

const UnitDetailDialog = ({ unitId, open, onClose, onChanged }: Props) => {
  const [data, setData] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const { data: unit, error } = await supabase
        .from("product_units")
        .select("id, serial_id, status, current_booking_id, product_id")
        .eq("id", unitId)
        .maybeSingle();
      if (error) throw error;
      if (!unit) {
        setData(null);
        return;
      }

      const { data: product } = await supabase
        .from("products")
        .select("id, name, brand, color, size, sku, daily_rental_rate")
        .eq("id", unit.product_id)
        .maybeSingle();

      const { data: rateRows } = await supabase
        .from("product_rental_rates")
        .select("rental_days, price")
        .eq("product_id", unit.product_id);

      const { data: imgs } = await supabase
        .from("product_images")
        .select("image_url, display_order")
        .eq("product_id", unit.product_id)
        .order("display_order", { ascending: true })
        .limit(1);

      // Find linked bookings via booking_items (don't trust current_booking_id alone — may be stale)
      const { data: items } = await supabase
        .from("booking_items")
        .select("booking_id, rental_price")
        .eq("product_unit_id", unit.id);

      const bookingIds = Array.from(
        new Set([
          ...((items ?? []).map((i: any) => i.booking_id).filter(Boolean) as string[]),
          ...(unit.current_booking_id ? [unit.current_booking_id as string] : []),
        ]),
      );

      const { data: bookingsData } = bookingIds.length
        ? await supabase
            .from("bookings")
            .select("id, status, rental_start, rental_end, grand_total, rental_total, deposit_total, delivery_fee, customer_id, created_at, promo_code, delivery_address, delivery_province, delivery_method, payment_slip_url")
            .in("id", bookingIds)
        : { data: [] as any[] };

      const bMap = new Map<string, any>();
      (bookingsData ?? []).forEach((b: any) => bMap.set(b.id, b));

      // Pick best booking: active > review (when unit for_review) > most recent
      const enriched = (items ?? [])
        .map((bi: any) => ({ bi, b: bMap.get(bi.booking_id) }))
        .filter((x: any) => x.b);
      let pickedBooking: any = null;
      let pickedPrice: number | null = null;
      const active = enriched.find((x: any) => ACTIVE_BOOKING_STATUSES.has(x.b.status));
      if (active) {
        pickedBooking = active.b;
        pickedPrice = Number(active.bi.rental_price ?? 0);
      } else {
        const review = enriched.find(
          (x: any) =>
            (x.b.status === "for_review" || x.b.status === "completed") &&
            unit.status === "for_review",
        );
        if (review) {
          pickedBooking = review.b;
          pickedPrice = Number(review.bi.rental_price ?? 0);
        } else if (unit.current_booking_id && bMap.get(unit.current_booking_id)) {
          pickedBooking = bMap.get(unit.current_booking_id);
        } else {
          const sorted = enriched.slice().sort(
            (a: any, b: any) =>
              new Date(b.b.created_at ?? 0).getTime() -
              new Date(a.b.created_at ?? 0).getTime(),
          );
          if (sorted[0]) {
            pickedBooking = sorted[0].b;
            pickedPrice = Number(sorted[0].bi.rental_price ?? 0);
          }
        }
      }

      let booking: UnitDetail["booking"] = null;
      if (pickedBooking) {
        const b = pickedBooking;
        const [{ data: cust }, { data: addr }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, phone, line_id, instagram_username")
            .eq("id", b.customer_id)
            .maybeSingle(),
          supabase
            .from("customer_addresses")
            .select("address_line1, address_line2, city, state, postal_code, country, is_default")
            .eq("customer_id", b.customer_id)
            .order("is_default", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        booking = {
          id: b.id,
          status: b.status,
          rental_start: b.rental_start,
          rental_end: b.rental_end,
          grand_total: Number(b.grand_total ?? 0),
          rental_total: Number(b.rental_total ?? 0),
          deposit_total: Number(b.deposit_total ?? 0),
          delivery_fee: Number(b.delivery_fee ?? 0),
          rental_price: Number(pickedPrice ?? 0),
          promo_code: (b as any).promo_code ?? null,
          delivery_address: (b as any).delivery_address ?? null,
          delivery_province: (b as any).delivery_province ?? null,
          delivery_method: (b as any).delivery_method ?? null,
          customer: {
            id: b.customer_id,
            name: cust?.full_name ?? "—",
            email: cust?.email ?? "",
            phone: cust?.phone ?? "",
            lineId: (cust as any)?.line_id ?? "",
            instagram: (cust as any)?.instagram_username ?? "",
          },
          address: addr ?? null,
        };
      }

      // Only show as a "live" booking on the customer panel when it's active
      // or a for_review case. Otherwise treat as no active customer.
      const hasActiveBooking =
        !!booking &&
        (ACTIVE_BOOKING_STATUSES.has(booking.status) ||
          ((booking.status === "completed" || booking.status === "for_review") &&
            unit.status === "for_review"));

      const displayStatus = deriveDisplayStatus(
        unit.status,
        hasActiveBooking ? booking!.status : null,
      );

      setData({
        id: unit.id,
        serial_id: unit.serial_id,
        status: unit.status,
        displayStatus,
        current_booking_id: hasActiveBooking ? booking!.id : null,
        product: {
          id: unit.product_id,
          name: product?.name ?? "—",
          daily_rental_rate: Number(product?.daily_rental_rate ?? 0),
          image: imgs?.[0]?.image_url ?? null,
          sku: skuOf(product),
          customRates: normalizeCustomRates(rateRows as any),
        },
        booking: hasActiveBooking ? booking : null,
      });
    } catch (e: any) {
      toast({ title: "Failed to load unit", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && unitId) load();
    else setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitId]);

  if (!open) return null;

  const transition = data ? TRANSITIONS[data.displayStatus] ?? TRANSITIONS[data.status] : null;

  const handleTransition = async () => {
    if (!data || !transition) return;
    // A later booking may not enter physical fulfilment while an earlier
    // booking still holds the same unit.
    if (
      transition.nextBooking &&
      isPhysicalFulfilmentStatus(transition.nextBooking) &&
      data.current_booking_id &&
      data.booking &&
      !isPhysicalFulfilmentStatus(data.booking.status)
    ) {
      const check = await checkUnitOccupancy({
        bookingId: data.current_booking_id,
        rentalStart: data.booking.rental_start,
        unitIds: [data.id],
      });
      if (check.blocked) {
        toast({ title: "Item still in use", description: UNIT_OCCUPIED_MESSAGE, variant: "destructive" });
        return;
      }
    }
    // Same precondition as the order view: payment can only be accepted with
    // a submitted slip, and accepting it must stamp payment_confirmed_at.
    const acceptingPayment =
      transition.nextBooking === "to_deliver" && data.booking?.status === "payment_submitted";
    if (acceptingPayment && !(data.booking as any)?.payment_slip_url) {
      toast({
        title: "No payment slip yet",
        description: "The customer hasn't uploaded a payment slip. Accept payment from the order view once it arrives.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const unitPatch: Database["public"]["Tables"]["product_units"]["Update"] = {
        status: transition.nextUnit,
      };
      if (transition.clearBooking) unitPatch.current_booking_id = null;
      const { error: uErr } = await supabase
        .from("product_units")
        .update(unitPatch)
        .eq("id", data.id);
      if (uErr) throw uErr;

      if (transition.nextBooking && data.current_booking_id && data.booking) {
        const bookingPatch: Database["public"]["Tables"]["bookings"]["Update"] = {
          status: transition.nextBooking,
        };
        if (acceptingPayment) bookingPatch.payment_confirmed_at = new Date().toISOString();
        // Compare-and-swap on the booking's current status so a stale unit
        // dialog can never regress or resurrect an order changed elsewhere.
        const { data: updatedRows, error: bErr } = await supabase
          .from("bookings")
          .update(bookingPatch)
          .eq("id", data.current_booking_id)
          .eq("status", data.booking.status)
          .select("id");
        if (bErr) throw bErr;
        if (!updatedRows?.length) {
          throw new Error("This order was changed elsewhere. Refreshing \u2014 please review its new status.");
        }
      }
      toast({ title: "Status updated" });
      emitBookingsChanged();
      onChanged?.();
      await load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const b = data?.booking ?? null;
  const duration = b ? dayDiff(b.rental_start, b.rental_end) : 0;
  const dailyRate = data?.product.daily_rental_rate ?? 0;
  // Display-only: same source/format as Product Listings & customer catalogue.
  const startingPrice = data
    ? getStartingPrice({ dailyRate, customRates: data.product.customRates })
    : null;
  const usesCustomPricing = !!data?.product.customRates.length;
  const rentalSubtotal = b ? b.rental_total : dailyRate * duration;

  const addr = b?.address;
  const fullAddress = formatRegisteredAddress(addr);
  const orderDeliveryAddress = resolveOrderDeliveryAddress(b?.delivery_address);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 -ml-2 self-start"
          >
            <ArrowLeft className="w-4 h-4" /> <span>Back</span>
          </button>
          <div className="flex items-center justify-between gap-4 mt-2">
            <div>
              <DialogTitle>Unit {data?.serial_id ?? "—"}</DialogTitle>
              <DialogDescription>
                {data ? data.product.name : "Loading…"}
              </DialogDescription>
            </div>
            {data && <StatusPill status={data.displayStatus} />}
          </div>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-6 mt-2">
            <Section title="Product Information">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {data.product.image ? (
                    <img src={data.product.image} alt={data.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-2 text-sm">
                  <KV label="Product" value={data.product.name} />
                  <KV label="SKU" value={<span className="font-mono text-xs">{data.product.sku}</span>} />
                  <KV label="Serial ID" value={<span className="font-mono text-xs">{data.serial_id}</span>} />
                  <KV
                    label="Starting Price"
                    value={
                      <span>
                        {startingPrice != null ? `From ${fmtTHB(startingPrice)}` : "—"}
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          {usesCustomPricing ? "Custom duration pricing" : "Auto daily pricing"}
                        </span>
                      </span>
                    }
                  />
                </div>
              </div>
            </Section>

            <Section title="Customer Information">
              {b ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <KV label="Customer ID" value={`#${b.customer.id.slice(0, 8)}`} />
                    <KV label="Name" value={b.customer.name} />
                    <KV
                      label="Email"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {b.customer.email || "—"}
                        </span>
                      }
                    />
                    <KV
                      label="Phone"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {b.customer.phone || "—"}
                        </span>
                      }
                    />
                    <KV
                      label="LINE ID"
                      value={
                        <span className="flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          {b.customer.lineId || <span className="text-muted-foreground">Not added</span>}
                        </span>
                      }
                    />
                    <KV
                      label="Instagram"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Instagram className="w-3.5 h-3.5 text-muted-foreground" />
                          {b.customer.instagram || <span className="text-muted-foreground">Not added</span>}
                        </span>
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Registered Address</p>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{fullAddress}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No active customer</p>
              )}
            </Section>

            {b && (
              <>
                <Section title="Delivery Details">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Delivery Address for This Order</p>
                      {orderDeliveryAddress ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span>{orderDeliveryAddress}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{NO_ORDER_ADDRESS}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <KV label="Delivery Province" value={b.delivery_province || "—"} />
                      <KV label="Delivery Method" value={deliveryMethodLabel(b.delivery_method) || "Not specified"} />
                    </div>
                  </div>
                </Section>

                <Section title="Transaction Details">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <KV label="Order ID" value={<span className="font-mono text-xs">{formatBookingReference(b.id)}</span>} />
                    <KV label="Booking status" value={<StatusPill status={b.status} />} />
                    <KV label="Rental duration" value={`${duration} day${duration > 1 ? "s" : ""}`} />
                    <KV label="Total amount" value={fmtTHB(b.grand_total)} />
                  </div>
                </Section>

                <Section title="Rental Schedule">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <KV
                      label="Start Date"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {fmtDate(b.rental_start)}
                        </span>
                      }
                    />
                    <KV
                      label="Last Rental Date"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {fmtDate(b.rental_end)}
                        </span>
                      }
                    />
                    <KV
                      label="Actual Return Date"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />{" "}
                          {formatActualReturnDate(b.rental_end)}
                        </span>
                      }
                    />

                  </div>
                </Section>

                <Section title="Payment Summary">
                  <div className="space-y-2 text-sm">
                    <Row label="Duration" value={`${duration} day${duration > 1 ? "s" : ""}`} />
                    <Row label="Rental subtotal" value={fmtTHB(rentalSubtotal)} />
                    <Row label="Deposit" value={fmtTHB(b.deposit_total)} />
                    {b.delivery_fee > 0 && <Row label="Delivery fee" value={fmtTHB(b.delivery_fee)} />}
                    <div className="border-t border-border pt-2 mt-2">
                      <Row label="Grand Total" value={fmtTHB(b.grand_total)} bold />
                    </div>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-muted-foreground">Promo Code</span>
                      <span className="font-medium">{b.promo_code?.trim() ? b.promo_code : "None"}</span>
                    </div>
                  </div>
                </Section>
              </>
            )}

            {(data?.displayStatus === "for_review" || data?.status === "for_review") && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {FOR_REVIEW_HINT}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={onClose}>Close</Button>
              {transition ? (
                <Button onClick={handleTransition} disabled={busy}>
                  {busy ? "Updating…" : transition.label}
                </Button>
              ) : data?.displayStatus === "for_review" || data?.status === "for_review" ? (
                <span className="self-center text-sm text-muted-foreground italic">
                  Awaiting return inspection
                </span>
              ) : (
                <span className="self-center text-sm text-muted-foreground italic">
                  Available for booking
                </span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
    {children}
  </div>
);

const KV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-medium mt-0.5">{value}</div>
  </div>
);

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex items-center justify-between ${bold ? "text-base font-semibold" : ""}`}>
    <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
    <span>{value}</span>
  </div>
);

export default UnitDetailDialog;
