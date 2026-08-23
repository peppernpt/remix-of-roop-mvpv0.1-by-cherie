import { deliveryMethodLabel } from "@/lib/booking-logic";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/customer/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatReturnAddress,
  RETURN_ADDRESS_MISSING,
  RETURN_ADDRESS_MISSING_HINT,
  RETURN_FEE_SHORT,
} from "@/lib/return-address";
import { formatBookingReference } from "@/lib/booking-reference";
import { formatDisplayDate, calculateRentalDays, formatActualReturnDate } from "@/lib/date-utils";
import { signPaymentSlip } from "@/lib/payment-slip";

const STATUS_HELPER: Record<string, string> = {
  pending_vendor_review: "Your request is waiting for the store to review.",
  approved_waiting_payment:
    "The store has approved your request. Please follow the payment instructions.",
  payment_submitted:
    "Your payment slip has been submitted. Waiting for the store to confirm.",
  paid: "Your payment has been confirmed by the store.",
  to_deliver: "The store is preparing your item for delivery.",
  on_delivery: "Your item is on the way.",
  on_rent: "Your rental is active.",
  on_return: "Your item is being returned.",
  for_review: "The store is reviewing the returned item.",
  completed: "This rental has been completed.",
  cancelled: "This request was cancelled or rejected.",
  rejected: "This request was cancelled or rejected.",
};

interface BookingDetail {
  id: string;
  status: string;
  rental_start: string;
  rental_end: string;
  rental_total: number;
  discounted_rental_total: number | null;
  deposit_total: number;
  delivery_fee: number;
  grand_total: number;
  promo_code: string | null;
  delivery_method: string | null;
  delivery_address: string | null;
  delivery_province: string | null;
  payment_slip_url: string | null;
  payment_submitted_at: string | null;
  delivery_tracking_url: string | null;
  return_address_snapshot: string | null;
  vendor_id: string;
  notes: string | null;
}

interface ItemRow {
  id: string;
  product_name: string;
  image?: string;
  serial_id?: string | null;
  condition?: string | null;
  size?: string | null;
  color?: string | null;
  rental_price: number;
  deposit_amount: number;
}

const baht = (n: number) => `฿${Number(n ?? 0).toLocaleString()}`;

const CustomerOrderDetailDialog = ({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [store, setStore] = useState<{
    name: string | null;
    line_id: string | null;
    instagram: string | null;
    return_address: string | null;
  } | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!open || !bookingId || !user) {
      setBooking(null);
      setItems([]);
      setStore(null);
      setSlipUrl(null);
      return;
    }
    (async () => {
      setLoading(true);
      // Scoped to the logged-in customer — a foreign booking id returns nothing.
      const { data: b } = await supabase
        .from("bookings")
        .select(
          "id, status, return_address_snapshot, rental_start, rental_end, rental_total, discounted_rental_total, deposit_total, delivery_fee, grand_total, promo_code, delivery_method, delivery_address, delivery_province, payment_slip_url, payment_submitted_at, delivery_tracking_url, vendor_id, notes",
        )
        .eq("id", bookingId)
        .eq("customer_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!b) {
        setBooking(null);
        setLoading(false);
        return;
      }
      setBooking(b as BookingDetail);

      const [{ data: bItems }, { data: vendor }] = await Promise.all([
        supabase
          .from("booking_items")
          .select("id, product_id, product_unit_id, rental_price, deposit_amount")
          .eq("booking_id", b.id),
        supabase
          .from("vendors")
          .select("store_name, line_id, instagram, store_address, subdistrict, city, postal_code")
          .eq("id", b.vendor_id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setStore(
        vendor
          ? {
              name: (vendor as any).store_name ?? null,
              line_id: ((vendor as any).line_id ?? "").trim() || null,
              instagram: ((vendor as any).instagram ?? "").trim() || null,
              return_address: formatReturnAddress(vendor as any),
            }
          : null,
      );

      const productIds = Array.from(
        new Set((bItems ?? []).map((i: any) => i.product_id)),
      );
      const unitIds = (bItems ?? [])
        .map((i: any) => i.product_unit_id)
        .filter(Boolean);

      const [{ data: products }, { data: images }, { data: units }] =
        await Promise.all([
          productIds.length
            ? supabase
                .from("products")
                .select("id, name, size, color")
                .in("id", productIds)
            : Promise.resolve({ data: [] as any[] } as any),
          productIds.length
            ? supabase
                .from("product_images")
                .select("product_id, image_url, display_order")
                .in("product_id", productIds)
                .order("display_order", { ascending: true })
            : Promise.resolve({ data: [] as any[] } as any),
          unitIds.length
            ? supabase
                .from("product_units")
                .select("id, serial_id, condition")
                .in("id", unitIds)
            : Promise.resolve({ data: [] as any[] } as any),
        ]);
      if (cancelled) return;

      const pMap = new Map((products ?? []).map((p: any) => [p.id, p]));
      const uMap = new Map((units ?? []).map((u: any) => [u.id, u]));
      const imgMap = new Map<string, string>();
      (images ?? []).forEach((im: any) => {
        if (!imgMap.has(im.product_id)) imgMap.set(im.product_id, im.image_url);
      });

      setItems(
        (bItems ?? []).map((i: any) => {
          const p: any = pMap.get(i.product_id);
          const u: any = uMap.get(i.product_unit_id);
          return {
            id: i.id,
            product_name: p?.name ?? "Item",
            image: imgMap.get(i.product_id),
            serial_id: u?.serial_id ?? null,
            condition: u?.condition ?? null,
            size: p?.size ?? null,
            color: p?.color ?? null,
            rental_price: Number(i.rental_price ?? 0),
            deposit_amount: Number(i.deposit_amount ?? 0),
          };
        }),
      );

      setSlipUrl(await signPaymentSlip(b.payment_slip_url));
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bookingId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const discount =
    booking && booking.discounted_rental_total != null
      ? Math.max(0, booking.rental_total - booking.discounted_rental_total)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Order {formatBookingReference(bookingId)}
            {booking && <StatusBadge status={booking.status} />}
          </DialogTitle>
        </DialogHeader>

        {loading && !booking ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : !booking ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Order not found.
          </p>
        ) : (
          <div className="space-y-5 text-sm">
            <Section title="Order status">
              <Row label="Booking reference" value={formatBookingReference(booking.id)} />
              <p className="text-muted-foreground">
                {STATUS_HELPER[booking.status] ?? "Order in progress."}
              </p>
            </Section>

            <Section title="Store information">
              <Row label="Store" value={store?.name ?? "—"} />
              {store?.line_id ? (
                <Row label="Store LINE ID" value={store.line_id} />
              ) : (
                <p className="text-muted-foreground">Store LINE ID not added yet.</p>
              )}
              {store?.instagram && (
                <Row label="Store Instagram" value={store.instagram} />
              )}
            </Section>

            <Section title="Ordered items">
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {it.image && (
                        <img src={it.image} alt={it.product_name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[it.size && `Size ${it.size}`, it.color]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {it.serial_id && (
                        <p className="text-xs text-muted-foreground">
                          Serial ID: <span className="font-mono">{it.serial_id}</span>
                        </p>
                      )}
                      {it.condition && (
                        <p className="text-xs text-muted-foreground">
                          Condition: {it.condition}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-medium text-foreground">{baht(it.rental_price)}</p>
                      <p className="text-muted-foreground">Deposit {baht(it.deposit_amount)}</p>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-muted-foreground">No items on this order.</p>
                )}
              </div>
            </Section>

            <Section title="Rental schedule">
              <Row label="Start date" value={formatDisplayDate(booking.rental_start)} />
              <Row label="Last rental date" value={formatDisplayDate(booking.rental_end)} />
              <Row label="Actual return date" value={formatActualReturnDate(booking.rental_end)} />
              <Row
                label="Days"
                value={String(calculateRentalDays(booking.rental_start, booking.rental_end))}
              />
              <Row label="Delivery method" value={deliveryMethodLabel(booking.delivery_method) || "—"} />
            </Section>

            <Section title="Delivery details">
              <Row
                label="Delivery address for this order"
                value={booking.delivery_address ?? "—"}
              />
              <Row label="Delivery province" value={booking.delivery_province ?? "—"} />
              <Row label="Delivery method" value={deliveryMethodLabel(booking.delivery_method) || "—"} />
            </Section>

            <Section title="Delivery tracking">
              {booking.delivery_tracking_url ? (
                <a
                  href={booking.delivery_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline break-all"
                >
                  Open tracking link
                </a>
              ) : (
                <p className="text-muted-foreground">Tracking link not added yet.</p>
              )}
            </Section>



            <Section title="Return instructions">
              <Row label="Return by" value={formatActualReturnDate(booking.rental_end)} />
              <Row
                label="Return address"
                value={
                  booking.return_address_snapshot ??
                  store?.return_address ??
                  RETURN_ADDRESS_MISSING
                }
              />
              {!(booking.return_address_snapshot ?? store?.return_address) && (
                <p className="text-xs text-muted-foreground">{RETURN_ADDRESS_MISSING_HINT}</p>
              )}
              <Row label="Return delivery fee" value={RETURN_FEE_SHORT} />
              {booking.status === "on_return" && (
                <p className="text-xs font-medium text-orange-700">
                  Please send the item back to the store by today and share the return tracking
                  details with the store via LINE.
                </p>
              )}
            </Section>

            <Section title="Payment summary">
              <Row label="Rental subtotal" value={baht(booking.rental_total)} />
              {discount > 0 && (
                <>
                  <Row label="Discount amount" value={`-${baht(discount)}`} />
                  <Row
                    label="Rental subtotal after discount"
                    value={baht(booking.discounted_rental_total ?? booking.rental_total)}
                  />
                </>
              )}
              <Row label="Delivery fee" value={baht(booking.delivery_fee)} />
              <Row label="Refundable deposit" value={baht(booking.deposit_total)} />
              {booking.promo_code && <Row label="Promo code" value={booking.promo_code} />}
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border font-semibold">
                <span>Total to pay</span>
                <span>{baht(booking.grand_total)}</span>
              </div>
            </Section>

            <Section title="Payment">
              {slipUrl ? (
                <div className="space-y-2">
                  <img
                    src={slipUrl}
                    alt="Payment slip"
                    className="w-full max-h-72 object-contain rounded-lg border border-border bg-muted"
                  />
                  {booking.payment_submitted_at && (
                    <Row
                      label="Submitted"
                      value={new Date(booking.payment_submitted_at).toLocaleString("en-GB")}
                    />
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {STATUS_HELPER[booking.status] ?? "No payment slip uploaded yet."}
                </p>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-1.5">
    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
    {children}
  </section>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground text-right break-words max-w-[60%]">{value}</span>
  </div>
);

export default CustomerOrderDetailDialog;
