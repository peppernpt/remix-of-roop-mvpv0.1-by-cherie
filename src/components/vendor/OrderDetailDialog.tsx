import { deliveryMethodLabel } from "@/lib/booking-logic";
import { parseDatabaseDate, calculateRentalDays, formatActualReturnDate } from "@/lib/date-utils";
import {
  resolveOrderDeliveryAddress,
  formatRegisteredAddress,
  NO_ORDER_ADDRESS,
} from "@/lib/delivery-address";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, MapPin, Calendar, Package2, ArrowLeft, MessageCircle, Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  type BookingStatus,
  STATUS_LABELS,
  STATUS_DETAIL_LABELS,
  STATUS_TONES,
  nextActions,
  unitStatusForBooking,
  getVendorRollbackAction,
  requiresForwardConfirmation,
  stageLabel,
} from "@/lib/booking-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { emitBookingsChanged } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { signPaymentSlip } from "@/lib/payment-slip";
import { checkApprovalAvailability, APPROVAL_CONFLICT_MESSAGE } from "@/lib/approval-availability";
import { releaseUnitsForCancelledBooking } from "@/lib/cancellation";
import {
  checkUnitOccupancy,
  isPhysicalFulfilmentStatus,
  UNIT_OCCUPIED_MESSAGE,
  type OccupancyResult,
} from "@/lib/unit-occupancy";

export interface VendorBookingItem {
  id: string;
  productId: string;
  productUnitId: string | null;
  productName: string;
  productImage: string | null;
  serial: string | null;
  unitStatus?: string | null;
  unitCondition?: string | null;
  unitNotes?: string | null;
  rentalPrice: number;
  depositAmount: number;
}

export interface VendorBooking {
  id: string;
  shortRef: string;
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
  rentalStart: string;
  rentalEnd: string;
  status: string;
  rentalTotal: number;
  depositTotal: number;
  deliveryFee: number;
  grandTotal: number;
  discountedRentalTotal?: number | null;
  notes: string | null;
  createdAt?: string;
  paymentSlipUrl?: string | null;
  paymentSubmittedAt?: string | null;
  deliveryMethod?: string | null;
  promoCode?: string | null;
  deliveryAddress?: string | null;
  deliveryProvince?: string | null;
  deliveryTrackingUrl?: string | null;
  returnPolicyAcknowledged?: boolean;
  returnPolicyAcknowledgedAt?: string | null;
  storePolicyAcknowledged?: boolean;
  storePolicyAcknowledgedAt?: string | null;
  items: VendorBookingItem[];
}

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 })
    .format(n);

const fmtDate = (d: string) =>
  parseDatabaseDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const dayDiff = (a: string, b: string) =>
  Math.max(1, calculateRentalDays(a, b));

interface Props {
  booking: VendorBooking | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (b: VendorBooking) => void;
}

const OrderDetailDialog = ({ booking: bookingProp, open, onClose, onUpdated }: Props) => {
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [savingFee, setSavingFee] = useState(false);
  const [transitioning, setTransitioning] = useState<BookingStatus | null>(null);
  const [inspectionCondition, setInspectionCondition] = useState<string>("");
  const [inspectionNotes, setInspectionNotes] = useState<string>("");
  const [republishing, setRepublishing] = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState<string>("");
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [paymentSlipUrl, setPaymentSlipUrl] = useState<string>("");

  const bookingId = bookingProp?.id ?? null;

  // Fresh booking-scoped fields fetched by id. Null until the selected booking
  // is hydrated, so nothing from a previously opened booking can leak through.
  const [fresh, setFresh] = useState<Partial<VendorBooking> | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    // Hard reset of every booking-specific piece of local state.
    setFresh(null);
    setDeliveryFee("0");
    setDiscountedPrice("");
    setTrackingUrl("");
    setInspectionCondition("");
    setInspectionNotes("");
    setPaymentSlipUrl("");
    setTransitioning(null);

    if (!open || !bookingId) return;
    let alive = true;
    setLoadingDetails(true);
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, status, delivery_address, delivery_province, delivery_method, promo_code, discounted_rental_total, delivery_fee, rental_total, deposit_total, grand_total, payment_slip_url, payment_submitted_at, delivery_tracking_url, notes, return_policy_acknowledged, return_policy_acknowledged_at, store_policy_acknowledged, store_policy_acknowledged_at",
        )
        .eq("id", bookingId)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setFresh({
          status: data.status,
          deliveryAddress: data.delivery_address ?? null,
          deliveryProvince: data.delivery_province ?? null,
          deliveryMethod: data.delivery_method ?? null,
          promoCode: data.promo_code ?? null,
          discountedRentalTotal:
            data.discounted_rental_total == null ? null : Number(data.discounted_rental_total),
          deliveryFee: Number(data.delivery_fee ?? 0),
          rentalTotal: Number(data.rental_total ?? 0),
          depositTotal: Number(data.deposit_total ?? 0),
          grandTotal: Number(data.grand_total ?? 0),
          paymentSlipUrl: data.payment_slip_url ?? null,
          paymentSubmittedAt: data.payment_submitted_at ?? null,
          deliveryTrackingUrl: data.delivery_tracking_url ?? null,
          notes: data.notes ?? null,
          returnPolicyAcknowledged: !!(data as any).return_policy_acknowledged,
          returnPolicyAcknowledgedAt: (data as any).return_policy_acknowledged_at ?? null,
          storePolicyAcknowledged: !!(data as any).store_policy_acknowledged,
          storePolicyAcknowledgedAt: (data as any).store_policy_acknowledged_at ?? null,
        });
      }
      setLoadingDetails(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, bookingId]);

  // The rendered booking is always the hydrated row for the selected id.
  const booking = useMemo(
    () => (bookingProp ? ({ ...bookingProp, ...(fresh ?? {}) } as VendorBooking) : null),
    [bookingProp, fresh],
  );

  useEffect(() => {
    if (!booking) return;
    setDeliveryFee(String(booking.deliveryFee || 0));
    setTrackingUrl(booking.deliveryTrackingUrl ?? "");
    // Input holds the discount AMOUNT. Derive from stored rental-after-discount.
    setDiscountedPrice(
      booking.discountedRentalTotal != null
        ? String(Math.max(booking.rentalTotal - booking.discountedRentalTotal, 0))
        : "",
    );
  }, [booking]);

  // Signed slip URL is derived ONLY from the hydrated row of the selected
  // booking id — never from a previously opened booking.
  useEffect(() => {
    setPaymentSlipUrl("");
    if (!open || !fresh) return;
    let alive = true;
    const slipRef = fresh.paymentSlipUrl ?? null;
    (async () => {
      const signed = slipRef ? await signPaymentSlip(slipRef) : null;
      if (alive) setPaymentSlipUrl(signed ?? "");
    })();
    return () => {
      alive = false;
    };
  }, [open, bookingId, fresh]);

  const status = booking?.status as BookingStatus | undefined;
  const actions = useMemo(() => (status ? nextActions(status) : []), [status]);
  const [confirm, setConfirm] = useState<
    { to: BookingStatus; label: string; kind: "forward" | "back" } | null
  >(null);

  // Physical-unit gating: a later booking may not enter fulfilment while an
  // earlier booking still physically holds the same unit.
  const [occupancy, setOccupancy] = useState<OccupancyResult | null>(null);
  const unitIdsKey = (bookingProp?.items ?? [])
    .map((i) => i.productUnitId)
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    setOccupancy(null);
    if (!open || !bookingProp || !status) return;
    // Only relevant before the order enters fulfilment.
    if (isPhysicalFulfilmentStatus(status) || ["completed", "cancelled", "rejected"].includes(status))
      return;
    let alive = true;
    (async () => {
      const res = await checkUnitOccupancy({
        bookingId: bookingProp.id,
        rentalStart: bookingProp.rentalStart,
        createdAt: bookingProp.createdAt,
        unitIds: unitIdsKey ? unitIdsKey.split(",") : [],
      });
      if (alive) setOccupancy(res);
    })();
    return () => {
      alive = false;
    };
  }, [open, bookingId, status, unitIdsKey]);

  if (!booking || !status) return null;

  const detailsLoading = loadingDetails && !fresh;

  // Keep the hydrated snapshot in sync with local saves so the merged view
  // never reverts to pre-save values.
  const applyUpdate = (b: VendorBooking) => {
    setFresh((prev) => ({ ...(prev ?? {}), ...b }));
    onUpdated(b);
  };


  const duration = dayDiff(booking.rentalStart, booking.rentalEnd);
  const paymentSlipRef = (fresh?.paymentSlipUrl ?? "")?.trim() ?? "";

  const saveTrackingUrl = async () => {
    const trimmed = trackingUrl.trim();
    if (trimmed !== "" && !/^https?:\/\/\S+$/i.test(trimmed)) {
      toast({ title: "Please enter a valid tracking link.", variant: "destructive" });
      return;
    }
    const value = trimmed === "" ? null : trimmed;
    setSavingTracking(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        delivery_tracking_url: value,
        delivery_tracking_updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
    setSavingTracking(false);
    if (error) {
      toast({
        title: "Failed to save tracking link",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: value ? "Tracking link saved" : "Tracking link removed" });
    applyUpdate({ ...booking, deliveryTrackingUrl: value });
  };


  const updateDeliveryFee = async () => {
    const fee = Number(deliveryFee);
    if (Number.isNaN(fee) || fee < 0) {
      toast({ title: "Invalid delivery fee", variant: "destructive" });
      return;
    }
    setSavingFee(true);
    // Delivery fee is added on top; discount (if any) only affects the rental subtotal.
    const rentalPart =
      booking.discountedRentalTotal !== null && booking.discountedRentalTotal !== undefined
        ? booking.discountedRentalTotal
        : booking.rentalTotal;
    const newGrand = rentalPart + booking.depositTotal + fee;

    const { error } = await supabase
      .from("bookings")
      .update({ delivery_fee: fee, grand_total: newGrand })
      .eq("id", booking.id);
    setSavingFee(false);
    if (error) {
      toast({ title: "Failed to update fee", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Delivery fee updated" });
    applyUpdate({ ...booking, deliveryFee: fee, grandTotal: newGrand });
  };

  const saveDiscountedPrice = async () => {
    const trimmed = discountedPrice.trim();
    let rentalAfterDiscount: number | null = null;
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (Number.isNaN(parsed) || parsed < 0) {
        toast({ title: "Discount amount must be a non-negative number", variant: "destructive" });
        return;
      }
      // Discount amount greater than rental subtotal is allowed → floor at 0.
      rentalAfterDiscount = Math.max(booking.rentalTotal - parsed, 0);
    }
    setSavingDiscount(true);
    // Discount applies ONLY to the rental subtotal. Delivery fee and deposit are always added on top.
    const rentalPart = rentalAfterDiscount !== null ? rentalAfterDiscount : booking.rentalTotal;
    const newGrand = rentalPart + booking.depositTotal + booking.deliveryFee;
    const { error } = await supabase
      .from("bookings")
      .update({ discounted_rental_total: rentalAfterDiscount, grand_total: newGrand })
      .eq("id", booking.id);
    setSavingDiscount(false);
    if (error) {
      toast({ title: "Failed to save discount", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: rentalAfterDiscount !== null ? "Discount saved" : "Discount cleared" });
    applyUpdate({ ...booking, discountedRentalTotal: rentalAfterDiscount, grandTotal: newGrand });
    emitBookingsChanged();
  };



  const transitionTo = async (next: BookingStatus) => {
    // Hard gate: never let a later booking enter physical fulfilment while an
    // earlier booking still holds the same unit (re-checked live at click time).
    if (isPhysicalFulfilmentStatus(next) && !isPhysicalFulfilmentStatus(status)) {
      const check = await checkUnitOccupancy({
        bookingId: booking.id,
        rentalStart: booking.rentalStart,
        createdAt: booking.createdAt,
        unitIds: booking.items.map((i) => i.productUnitId).filter(Boolean) as string[],
      });
      setOccupancy(check);
      if (check.blocked) {
        toast({
          title: "Item still in use",
          description: UNIT_OCCUPIED_MESSAGE,
          variant: "destructive",
        });
        return;
      }
    }
    setTransitioning(next);
    try {
      // Vendor approval: re-check date availability before accepting a pending
      // request, so two overlapping requests can never both be approved.
      let approvedItems = booking.items;
      if (next === "approved_waiting_payment" && booking.status === "pending_vendor_review") {
        const check = await checkApprovalAvailability({
          bookingId: booking.id,
          rentalStart: booking.rentalStart,
          rentalEnd: booking.rentalEnd,
          items: booking.items.map((it) => ({
            id: it.id,
            productId: it.productId,
            productUnitId: it.productUnitId,
          })),
        });
        if (!check.ok) {
          toast({
            title: "Item unavailable",
            description: check.message ?? APPROVAL_CONFLICT_MESSAGE,
            variant: "destructive",
          });
          setTransitioning(null);
          return;
        }
        // Swap to a free unit of the same product where needed.
        for (const r of check.reassignments) {
          const { error: rErr } = await supabase
            .from("booking_items")
            .update({ product_unit_id: r.productUnitId })
            .eq("id", r.bookingItemId);
          if (rErr) throw rErr;
        }
        if (check.reassignments.length) {
          approvedItems = booking.items.map((it) => {
            const r = check.reassignments.find((x) => x.bookingItemId === it.id);
            return r ? { ...it, productUnitId: r.productUnitId } : it;
          });
        }
      }

      // Update booking status (and payment timestamp where relevant)
      const bookingPatch: Record<string, any> = { status: next };
      if (next === "paid" || (next === "to_deliver" && booking.status === "payment_submitted")) {
        bookingPatch.payment_confirmed_at = new Date().toISOString();
      }
      // If vendor rejects the slip, send the order back to awaiting payment
      // and clear the rejected slip so the customer can re-upload.
      if (next === "approved_waiting_payment" && booking.status === "payment_submitted") {
        bookingPatch.payment_slip_url = null;
        bookingPatch.payment_submitted_at = null;
      }
      const { error: bErr } = await supabase
        .from("bookings")
        .update(bookingPatch)
        .eq("id", booking.id);
      if (bErr) throw bErr;


      // Sync product_units status if the rental physically moved.
      // Booking-only states (approved_waiting_payment, payment_submitted, paid) keep units "reserved".
      const unitStatus = unitStatusForBooking(next);
      const unitIds = approvedItems.map((i) => i.productUnitId).filter(Boolean) as string[];
      if (next === "cancelled") {
        // Cancellation / rejection: release units only when no other active
        // booking still holds them (booking_items are kept for history).
        await releaseUnitsForCancelledBooking({ bookingId: booking.id, unitIds });
      } else if (unitStatus && unitIds.length) {
        const { error: uErr } = await supabase
          .from("product_units")
          .update({ status: unitStatus })
          .in("id", unitIds);
        if (uErr) throw uErr;
      }

      toast({ title: `Order ${STATUS_LABELS[next]}` });
      const patched: VendorBooking = { ...booking, status: next, items: approvedItems };
      if (bookingPatch.payment_slip_url === null) {
        patched.paymentSlipUrl = null;
        patched.paymentSubmittedAt = null;
      }
      applyUpdate(patched);
      emitBookingsChanged();
    } catch (e: any) {
      toast({
        title: "Failed to update order",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setTransitioning(null);
    }
  };

  // Units linked to this booking that are awaiting vendor inspection.
  const flaggedReviewUnitIds = booking.items
    .filter((it) => it.unitStatus === "for_review" && it.productUnitId)
    .map((it) => it.productUnitId as string);
  const allUnitIds = booking.items
    .filter((it) => it.productUnitId)
    .map((it) => it.productUnitId as string);
  // booking.status is the source of truth: a booking in "for_review" is always
  // inspectable, even if a unit row wasn't flagged (legacy / partial updates).
  const reviewUnitIds =
    status === "for_review" && flaggedReviewUnitIds.length === 0
      ? allUnitIds
      : flaggedReviewUnitIds;
  const showInspection =
    status === "for_review" || (status === "completed" && reviewUnitIds.length > 0);
  // Limited rollback: one step back within post-payment operational stages only.
  const rollback = getVendorRollbackAction(status, reviewUnitIds.length > 0);

  const republishUnits = async () => {
    if (!inspectionCondition || reviewUnitIds.length === 0) return;

    setRepublishing(true);
    try {
      const { error } = await supabase
        .from("product_units")
        .update({
          condition: inspectionCondition,
          status: "available",
          current_booking_id: null,
          ...(inspectionNotes.trim() ? { notes: inspectionNotes.trim() } : {}),
        })
        .in("id", reviewUnitIds);
      if (error) throw error;

      // Only the final inspection/republish action completes the booking.
      if (booking.status !== "completed") {
        const { error: bErr } = await supabase
          .from("bookings")
          .update({ status: "completed" })
          .eq("id", booking.id);
        if (bErr) throw bErr;
      }

      toast({
        title: "Item republished",
        description: inspectionNotes
          ? "Inspection notes captured for this session."
          : "Unit is now available again.",
      });

      const patched: VendorBooking = {
        ...booking,
        status: "completed",
        items: booking.items.map((it) =>
          reviewUnitIds.includes(it.productUnitId ?? "")
            ? { ...it, unitStatus: "available" }
            : it,
        ),
      };
      applyUpdate(patched);
      emitBookingsChanged();
      setInspectionCondition("");
      setInspectionNotes("");
    } catch (e: any) {
      toast({
        title: "Failed to republish",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setRepublishing(false);
    }
  };

  const addr = booking.address;
  const fullAddress = formatRegisteredAddress(addr);
  // Delivery Details is booking-scoped only — never falls back to the profile address.
  const orderDeliveryAddress = resolveOrderDeliveryAddress(booking.deliveryAddress);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 -ml-2 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center justify-between gap-4 mt-2">
            <div>
              <DialogTitle>Order #{booking.shortRef}</DialogTitle>
              <DialogDescription>{STATUS_DETAIL_LABELS[status]}</DialogDescription>
            </div>
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium",
                STATUS_TONES[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
        </DialogHeader>

        {detailsLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading order details…
          </div>
        ) : (
        <div className="space-y-6 mt-2">
          <Section title="Customer Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <KV label="Name" value={booking.customer.name} />
              <KV label="Customer ID" value={`#${booking.customer.id.slice(0, 8)}`} />
              <KV
                label="Email"
                value={
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {booking.customer.email || "—"}
                  </span>
                }
              />
              <KV
                label="Phone"
                value={
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {booking.customer.phone || "—"}
                  </span>
                }
              />
              <KV
                label="LINE ID"
                value={
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    {booking.customer.lineId || <span className="text-muted-foreground">Not added</span>}
                  </span>
                }
              />
              <KV
                label="Instagram"
                value={
                  <span className="flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-muted-foreground" />
                    {booking.customer.instagram || <span className="text-muted-foreground">Not added</span>}
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
          </Section>

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
                <KV label="Delivery Province" value={booking.deliveryProvince || "—"} />
                <KV label="Delivery Method" value={deliveryMethodLabel(booking.deliveryMethod) || "Not specified"} />
              </div>
              <p className="text-xs text-muted-foreground">
                This is the delivery address entered for this booking request.
              </p>
              {booking.returnPolicyAcknowledged && (
                <p className="text-xs text-muted-foreground">
                  Customer acknowledged return responsibility.
                  {booking.returnPolicyAcknowledgedAt
                    ? ` Acknowledged on ${new Date(
                        booking.returnPolicyAcknowledgedAt,
                      ).toLocaleString("en-GB")}`
                    : ""}
                </p>
              )}
              {booking.storePolicyAcknowledged && (
                <p className="text-xs text-muted-foreground">
                  Customer acknowledged your store rental policy.
                  {booking.storePolicyAcknowledgedAt
                    ? ` Acknowledged on ${new Date(booking.storePolicyAcknowledgedAt).toLocaleString("en-GB")}`
                    : ""}
                </p>
              )}
            </div>
          </Section>






          <Section title="Ordered Items">
            <div className="space-y-2">
              {booking.items.map((it) => (
                <div
                  key={it.id}
                  className="p-3 rounded-lg border border-border bg-muted/20 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      {it.productImage ? (
                        <img src={it.productImage} alt={it.productName} className="w-full h-full object-cover" />
                      ) : (
                        <Package2 className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{it.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.serial ? `SN: ${it.serial}` : "No serial"} · Qty 1
                      </div>
                      {it.unitCondition && (
                        <div className="text-xs text-muted-foreground">
                          Condition: <span className="capitalize">{it.unitCondition}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{fmtTHB(it.rentalPrice)}</div>
                      <div className="text-xs text-muted-foreground">
                        Deposit {fmtTHB(it.depositAmount)}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/60 border border-border/60 px-2.5 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Unit Notes
                    </div>
                    <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">
                      {it.unitNotes?.trim()
                        ? it.unitNotes
                        : <span className="text-muted-foreground">No unit notes added.</span>}
                    </p>
                  </div>
                </div>

              ))}
            </div>
          </Section>

          <Section title="Rental Schedule">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV
                label="Start Date"
                value={
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {fmtDate(booking.rentalStart)}
                  </span>
                }
              />
              <KV
                label="Last Rental Date"
                value={
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {fmtDate(booking.rentalEnd)}
                  </span>
                }
              />
              <KV
                label="Actual Return Date"
                value={
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatActualReturnDate(booking.rentalEnd)}
                  </span>
                }
              />
              <KV label="Days" value={`${duration}`} />
            </div>

            <div className="mt-3">
              <KV
                label="Delivery Method"
                value={deliveryMethodLabel(booking.deliveryMethod) || "Not specified"}
              />
            </div>
          </Section>

          <Section title="Delivery Fee">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Amount (THB)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  value={deliveryFee}
                  onChange={(e) => {
                    const v = e.target.value;
                    // block negatives and non-numeric chars (allow empty)
                    if (v === "" || (/^\d*\.?\d*$/.test(v) && Number(v) >= 0)) {
                      setDeliveryFee(v);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "+") e.preventDefault();
                  }}
                  disabled={["completed", "cancelled"].includes(status)}
                />
              </div>
              <Button
                onClick={updateDeliveryFee}
                disabled={savingFee || ["completed", "cancelled"].includes(status) || !(Number(deliveryFee) > 0)}
                variant="outline"
              >
                {savingFee ? "Saving…" : "Update Fee"}
              </Button>
            </div>
            {status === "pending_vendor_review" && !(Number(deliveryFee) > 0) ? (
              <p className="text-[11px] text-destructive mt-1.5">
                Please enter delivery fee before approving
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Confirm with the customer before approving. Updates the grand total.
              </p>
            )}
          </Section>

          {booking.promoCode?.trim() && (
            <Section title="Promo Code">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Promo Code</span>
                  <span className="font-medium">{booking.promoCode}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Original Rental Subtotal</span>
                  <span className="font-medium">{fmtTHB(booking.rentalTotal)}</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Discount Amount (THB)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      inputMode="numeric"
                      placeholder="Leave empty for no discount"
                      value={discountedPrice}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || (/^\d*\.?\d*$/.test(v) && Number(v) >= 0)) {
                          setDiscountedPrice(v);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "+") e.preventDefault();
                      }}
                      disabled={["completed", "cancelled"].includes(status)}
                    />
                  </div>
                  <Button
                    onClick={saveDiscountedPrice}
                    disabled={savingDiscount || ["completed", "cancelled"].includes(status)}
                    variant="outline"
                  >
                    {savingDiscount ? "Saving…" : "Save Discount"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This discount only applies to the rental price. If the discount is higher than the rental subtotal, the rental subtotal will become ฿0. Delivery fee and deposit will still be added separately.
                </p>

              </div>
            </Section>
          )}

          <Section title="Payment Summary">
            <div className="space-y-2 text-sm">
              {booking.discountedRentalTotal !== null && booking.discountedRentalTotal !== undefined ? (
                <>
                  <Row
                    label="Original Rental Subtotal"
                    value={fmtTHB(booking.rentalTotal)}
                    strike
                  />
                  <Row
                    label="Discount Amount"
                    value={`-${fmtTHB(Math.max(booking.rentalTotal - booking.discountedRentalTotal, 0))}`}
                  />
                  <Row
                    label="Rental Subtotal After Discount"
                    value={fmtTHB(booking.discountedRentalTotal)}
                  />
                </>
              ) : (
                <Row label="Rental Subtotal" value={fmtTHB(booking.rentalTotal)} />
              )}
              <Row label="Delivery Fee" value={fmtTHB(booking.deliveryFee)} />
              <Row label="Refundable Deposit" value={fmtTHB(booking.depositTotal)} />
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Total to Pay" value={fmtTHB(booking.grandTotal)} bold />
              </div>
              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-muted-foreground">Promo Code</span>
                <span className="font-medium">{booking.promoCode?.trim() ? booking.promoCode : "None"}</span>
              </div>
            </div>
          </Section>

          {!["cancelled", "rejected"].includes(status) && (
            <Section title="Delivery Tracking">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Tracking Link</Label>
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="Paste delivery tracking link here"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                  />
                </div>
                <Button onClick={saveTrackingUrl} disabled={savingTracking} variant="outline">
                  {savingTracking ? "Saving…" : "Save Tracking Link"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                This link will be shown to the customer on their Tracking page.
              </p>
            </Section>
          )}


          {(paymentSlipRef || status === "payment_submitted" || status === "paid") && (
            <Section title="Payment Slip">
              {paymentSlipRef ? (
                <div className="space-y-2">
                  <a
                    href={paymentSlipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-foreground transition-colors"
                  >
                    <img
                      src={paymentSlipUrl}
                      alt="Payment slip"
                      className="w-full max-h-72 object-contain bg-background"
                    />
                  </a>
                  <Button asChild variant="outline" size="sm">
                    <a href={paymentSlipUrl} target="_blank" rel="noreferrer">Open Slip</a>
                  </Button>
                  {booking.paymentSubmittedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Submitted {new Date(booking.paymentSubmittedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No payment slip uploaded for this order.
                </p>
              )}
            </Section>
          )}

          {showInspection && (
            <Section title="Return Inspection">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Condition</Label>
                  <Select
                    value={inspectionCondition}
                    onValueChange={setInspectionCondition}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select condition…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    className="mt-1"
                    placeholder="Add inspection notes or damage remarks…"
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </Section>
          )}

          {occupancy?.blocked && !isPhysicalFulfilmentStatus(status) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {UNIT_OCCUPIED_MESSAGE}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {rollback && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm({ to: rollback.to, label: rollback.label, kind: "back" })}
                disabled={transitioning !== null}
              >
                <ArrowLeft className="w-4 h-4" /> {rollback.label}
              </Button>
            )}
            {showInspection && status === "for_review" && (
              <Button
                onClick={republishUnits}
                disabled={!inspectionCondition || republishing}
                title={
                  !inspectionCondition
                    ? "Please select item condition before republishing."
                    : undefined
                }
              >
                {republishing ? "Republishing…" : "Republish Item"}
              </Button>
            )}
            {actions.map((a) => {

              const isApprove =
                status === "pending_vendor_review" && a.tone !== "destructive";
              const blockApprove = isApprove && !(booking.deliveryFee > 0);
              const isAcceptPayment =
                status === "payment_submitted" && a.tone !== "destructive";
              const blockAccept = isAcceptPayment && !paymentSlipRef;
              // A later booking cannot enter fulfilment while an earlier
              // booking still physically holds the same unit.
              const blockOccupied =
                a.tone !== "destructive" &&
                isPhysicalFulfilmentStatus(a.to) &&
                !!occupancy?.blocked;
              const disabledTitle = blockApprove
                ? "Enter and save a delivery fee first"
                : blockAccept
                  ? "Customer hasn't uploaded a payment slip yet"
                  : blockOccupied
                    ? UNIT_OCCUPIED_MESSAGE
                    : undefined;
              return (
                <Button
                  key={a.to}
                  onClick={() =>
                    requiresForwardConfirmation(status, a.to)
                      ? setConfirm({ to: a.to, label: a.label, kind: "forward" })
                      : transitionTo(a.to)
                  }
                  disabled={transitioning !== null || blockApprove || blockAccept || blockOccupied}
                  variant={a.tone === "destructive" ? "destructive" : "default"}
                  title={disabledTitle}
                >
                  {transitioning === a.to ? "Updating…" : a.label}
                </Button>
              );
            })}
          </div>

          <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirm?.kind === "back"
                    ? `Move this order back to ${stageLabel(confirm.to, confirm.to === "completed")}?`
                    : confirm
                      ? `Move this order to ${stageLabel(confirm.to, confirm.to === "completed")}?`
                      : ""}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm?.kind === "back"
                    ? "This corrects an accidental status change. Rental dates stay blocked and the assigned items move back with the order."
                    : "The assigned items move to the next stage together with this order."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const target = confirm?.to;
                    setConfirm(null);
                    if (target) transitionTo(target);
                  }}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2">
      {title}
    </h3>
    {children}
  </div>
);

const KV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-medium mt-0.5">{value}</div>
  </div>
);

const Row = ({ label, value, bold, strike }: { label: string; value: string; bold?: boolean; strike?: boolean }) => (
  <div className={`flex items-center justify-between ${bold ? "text-base font-semibold" : ""}`}>
    <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
    <span className={strike ? "line-through text-muted-foreground" : ""}>{value}</span>
  </div>
);

export default OrderDetailDialog;
