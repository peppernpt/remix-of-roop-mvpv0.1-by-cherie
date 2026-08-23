import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VendorBooking } from "@/components/vendor/OrderDetailDialog";
import { onBookingsChanged } from "@/lib/sync";

export const useVendorBookings = (vendorId: string | undefined) => {
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: bErr } = await supabase
        .from("bookings")
        .select(`
          id, status, rental_start, rental_end,
          rental_total, deposit_total, delivery_fee, grand_total,
          discounted_rental_total,
          notes, customer_id, created_at,
          payment_slip_url, payment_submitted_at, delivery_method, promo_code,
          delivery_address, delivery_province, delivery_tracking_url,
          booking_items (
            id, rental_price, deposit_amount,
            product_id, product_unit_id,
            products:product_id ( id, name, product_images ( image_url, display_order ) ),
            product_units:product_unit_id ( id, serial_id, status, condition, notes )
          )
        `)
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;

      const customerIds = Array.from(new Set((rows ?? []).map((r: any) => r.customer_id)));
      const [profilesRes, addressesRes] = await Promise.all([
        customerIds.length
          ? supabase.from("profiles").select("id, full_name, email, phone, line_id, instagram_username").in("id", customerIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        customerIds.length
          ? supabase
              .from("customer_addresses")
              .select("customer_id, address_line1, address_line2, city, state, postal_code, country, is_default")
              .in("customer_id", customerIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const profileMap = new Map<string, any>();
      (profilesRes.data ?? []).forEach((p: any) => profileMap.set(p.id, p));
      const addressMap = new Map<string, any>();
      (addressesRes.data ?? []).forEach((a: any) => {
        const existing = addressMap.get(a.customer_id);
        if (!existing || a.is_default) addressMap.set(a.customer_id, a);
      });

      const mapped: VendorBooking[] = (rows ?? []).map((r: any) => {
        const p = profileMap.get(r.customer_id);
        const a = addressMap.get(r.customer_id);
        return {
          id: r.id,
          shortRef: r.id.replace(/-/g, "").slice(0, 6).toUpperCase(),
          customer: {
            id: r.customer_id,
            name: p?.full_name ?? "Customer",
            email: p?.email ?? "",
            phone: p?.phone ?? "",
            lineId: p?.line_id ?? "",
            instagram: p?.instagram_username ?? "",
          },
          address: a
            ? {
                address_line1: a.address_line1,
                address_line2: a.address_line2,
                city: a.city,
                state: a.state,
                postal_code: a.postal_code,
                country: a.country,
              }
            : null,
          rentalStart: r.rental_start,
          rentalEnd: r.rental_end,
          status: r.status,
          rentalTotal: Number(r.rental_total ?? 0),
          depositTotal: Number(r.deposit_total ?? 0),
          deliveryFee: Number(r.delivery_fee ?? 0),
          grandTotal: Number(r.grand_total ?? 0),
          discountedRentalTotal: r.discounted_rental_total == null ? null : Number(r.discounted_rental_total),
          notes: r.notes,
          createdAt: r.created_at,
          paymentSlipUrl: r.payment_slip_url ?? null,
          paymentSubmittedAt: r.payment_submitted_at ?? null,
          deliveryMethod: r.delivery_method ?? null,
          promoCode: r.promo_code ?? null,
          deliveryAddress: r.delivery_address ?? null,
          deliveryProvince: r.delivery_province ?? null,
          deliveryTrackingUrl: r.delivery_tracking_url ?? null,
          items: (r.booking_items ?? []).map((bi: any) => {
            const imgs = (bi.products?.product_images ?? [])
              .slice()
              .sort((x: any, y: any) => (x.display_order ?? 0) - (y.display_order ?? 0));
            return {
              id: bi.id,
              productId: bi.product_id,
              productUnitId: bi.product_unit_id,
              productName: bi.products?.name ?? "Product",
              productImage: imgs[0]?.image_url ?? null,
              serial: bi.product_units?.serial_id ?? null,
              unitStatus: bi.product_units?.status ?? null,
              unitCondition: bi.product_units?.condition ?? null,
              unitNotes: bi.product_units?.notes ?? null,
              rentalPrice: Number(bi.rental_price ?? 0),
              depositAmount: Number(bi.deposit_amount ?? 0),
            };
          }),
        };
      });

      setBookings(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) refresh();
  }, [vendorId, refresh]);

  useEffect(() => {
    if (!vendorId) return;
    return onBookingsChanged(() => refresh());
  }, [vendorId, refresh]);

  const replaceBooking = useCallback((b: VendorBooking) => {
    setBookings((prev) => prev.map((x) => (x.id === b.id ? b : x)));
  }, []);

  return { bookings, loading, error, refresh, replaceBooking };
};
