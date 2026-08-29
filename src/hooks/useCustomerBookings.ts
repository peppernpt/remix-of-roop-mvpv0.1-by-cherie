import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingsChanged, startBookingsRealtime } from "@/lib/sync";
import { formatReturnAddress } from "@/lib/return-address";

export interface CustomerBookingRow {
  id: string;
  vendor_id: string;
  rental_start: string;
  rental_end: string;
  status: string;
  rental_total: number;
  deposit_total: number;
  delivery_fee: number;
  grand_total: number;
  notes: string | null;
  created_at: string;
  payment_slip_url: string | null;
  payment_submitted_at: string | null;
  delivery_tracking_url: string | null;
  return_address_snapshot: string | null;
  vendor_name?: string;
  vendor_return_address?: string | null;
  product_names: string[];
  product_image?: string;
}

const ACTIVE_STATUSES = new Set([
  "pending_vendor_review",
  "approved_waiting_payment",
  "payment_submitted",
  "paid",
  "to_deliver",
  "on_delivery",
  "on_rent",
  "on_return",
  // Return inspection: the vendor still holds the deposit — the order must
  // stay visible to the customer until it completes.
  "for_review",
]);

export const isActive = (s: string) => ACTIVE_STATUSES.has(s);

export const useCustomerBookings = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<CustomerBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: bks, error: bErr } = await supabase
        .from("bookings")
        .select(
          "id, vendor_id, rental_start, rental_end, status, rental_total, deposit_total, delivery_fee, grand_total, notes, created_at, payment_slip_url, payment_submitted_at, delivery_tracking_url, return_address_snapshot"
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;

      const vendorIds = Array.from(new Set((bks ?? []).map((b) => b.vendor_id)));
      const { data: vendors } = vendorIds.length
        ? await supabase
            .from("vendors_public")
            .select("id, store_name, logo_url, store_address, subdistrict, city, postal_code")
            .in("id", vendorIds)
        : { data: [] as any[] };
      const vendorMap = new Map(
        (vendors ?? []).map((v: any) => [v.id, v.store_name as string])
      );
      // Store return address (never the customer's own address).
      const vendorReturnMap = new Map(
        (vendors ?? []).map((v: any) => [v.id, formatReturnAddress(v)])
      );

      const bookingIds = (bks ?? []).map((b) => b.id);
      const { data: items } = bookingIds.length
        ? await supabase
            .from("booking_items")
            .select("booking_id, product_id")
            .in("booking_id", bookingIds)
        : { data: [] as any[] };

      const productIds = Array.from(
        new Set((items ?? []).map((i: any) => i.product_id))
      );
      const { data: products } = productIds.length
        ? await supabase
            .from("products")
            .select("id, name")
            .in("id", productIds)
        : { data: [] as any[] };
      const productMap = new Map(
        (products ?? []).map((p: any) => [p.id, p.name as string])
      );

      const { data: images } = productIds.length
        ? await supabase
            .from("product_images")
            .select("product_id, image_url, display_order")
            .in("product_id", productIds)
            .order("display_order", { ascending: true })
        : { data: [] as any[] };
      const imageMap = new Map<string, string>();
      (images ?? []).forEach((im: any) => {
        if (!imageMap.has(im.product_id)) imageMap.set(im.product_id, im.image_url);
      });

      const itemsByBooking = new Map<string, any[]>();
      (items ?? []).forEach((it: any) => {
        const arr = itemsByBooking.get(it.booking_id) ?? [];
        arr.push(it);
        itemsByBooking.set(it.booking_id, arr);
      });

      const rows: CustomerBookingRow[] = (bks ?? []).map((b) => {
        const its = itemsByBooking.get(b.id) ?? [];
        return {
          ...b,
          vendor_name: vendorMap.get(b.vendor_id),
          vendor_return_address:
            (b as any).return_address_snapshot ?? vendorReturnMap.get(b.vendor_id) ?? null,
          product_names: its
            .map((i) => productMap.get(i.product_id))
            .filter(Boolean) as string[],
          product_image: its.map((i) => imageMap.get(i.product_id)).find(Boolean),
        };
      });

      setData(rows);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Drop the previous identity's rows before loading the new user's data.
    setData([]);
    setError(null);
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchBookings();
  }, [user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    // The sync bus already refetches on focus/visibility — registering our own
    // duplicates here caused multiplied refetch storms.
    const offBus = onBookingsChanged(() => fetchBookings());
    // Live updates (approval, payment confirmation…) when realtime is enabled.
    const offLive = startBookingsRealtime(`customer-${user.id}`, `customer_id=eq.${user.id}`);
    return () => {
      offBus();
      offLive();
    };
  }, [user, fetchBookings]);

  return { data, loading, error, refresh: fetchBookings };
};
