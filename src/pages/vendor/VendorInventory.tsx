import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, MoreVertical, Pencil, Eye, Archive, ArchiveRestore, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { buildSku } from "@/lib/sku";
import { formatBookingReference } from "@/lib/booking-reference";
import { toast } from "@/hooks/use-toast";
import VendorTopBar from "@/components/vendor/VendorTopBar";
import { useVendor } from "@/hooks/useVendor";
import ProductUnitsDialog from "@/components/vendor/ProductUnitsDialog";
import UnitDetailDialog from "@/components/vendor/UnitDetailDialog";
import OrderDetailDialog, { type VendorBooking } from "@/components/vendor/OrderDetailDialog";
import { useVendorBookings } from "@/hooks/useVendorBookings";
import { cn } from "@/lib/utils";
import { onBookingsChanged } from "@/lib/sync";
import { findCustomRate, normalizeCustomRates } from "@/lib/pricing";
import { PHYSICAL_LIFECYCLE_SET } from "@/lib/unit-occupancy";

interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  daily_rental_rate: number;
  /** 1-day starting price for the Product Listings column. null = no usable price. */
  startingPrice: number | null;
  is_active: boolean;
  primaryImage: string | null;
  sku: string;
  total: number;
  available: number;
  onRent: number;
}

interface UnitRow {
  id: string;
  serial_id: string;
  status: string; // raw product_units.status
  displayStatus: string; // derived from booking.status + unit.status
  product_id: string;
  product_name: string;
  primaryImage: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  sku: string;
  daily_rental_rate: number;
  current_booking_id: string | null;
  order_short: string | null;
  customer_short: string | null;
  rent_price: number | null;
}


/** One booking_item row shown in a process tab. */
interface StatusRow {
  key: string;
  unitId: string | null;
  serial: string;
  productName: string;
  primaryImage: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  sku: string;
  tab: string;
  orderShort: string;
  customerShort: string;
  rentalStart: string;
  booking: VendorBooking;
}

/** bookings.status → Item Status process tab (null = not a process row). */
const tabForBookingStatus = (s: string): string | null => {
  switch (s) {
    case "pending_vendor_review":
      return "pending_request";
    case "approved_waiting_payment":
      return "waiting_payment";
    case "payment_submitted":
      return "payment_submitted";
    case "paid":
    case "to_deliver":
      return "to_deliver";
    case "on_delivery":
      return "on_delivery";
    case "on_rent":
      return "on_rent";
    case "on_return":
      return "on_return";
    case "for_review":
      return "for_review";
    default:
      return null;
  }
};

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
  if (bookingStatus === "paid" || bookingStatus === "to_deliver") return "to_deliver";
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

/** Stored readable SKU, with a derived fallback for legacy rows. */
const skuOf = (p?: { sku?: string | null; name?: string | null; brand?: string | null; color?: string | null; size?: string | null } | null) =>
  p ? (p.sku?.trim() || buildSku(p)) : "—";
const shortId = (id: string | null | undefined) =>
  id ? `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}` : "—";

const STATUS_TABS = [
  { key: "available", label: "Available" },
  { key: "pending_request", label: "Pending Request" },
  { key: "waiting_payment", label: "Waiting Payment" },
  { key: "payment_submitted", label: "Payment Submitted" },
  { key: "to_deliver", label: "To Deliver" },
  { key: "on_delivery", label: "On Delivery" },
  { key: "on_rent", label: "On Rent" },
  { key: "on_return", label: "On Return" },
  { key: "for_review", label: "For Review" },
] as const;

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  available: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Available" },
  pending_request: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Pending Request" },
  waiting_payment: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Waiting Payment" },
  payment_submitted: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Payment Submitted" },
  reserved: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Reserved" },
  to_deliver: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", label: "To Deliver" },
  on_delivery: { dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "On Delivery" },
  on_rent: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "On Rent" },
  on_return: { dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200", label: "On Return" },
  for_review: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200", label: "For Review" },
  unavailable: { dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 border-zinc-200", label: "Unavailable" },
};


const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] ?? { dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 border-zinc-200", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border", s.badge)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
};

/** Empty variant fields render as an em dash. */
const dash = (v: string | null | undefined) => (v && v.trim() ? v : "—");

/** Mobile-only stacked Brand / Size / Color metadata under the product name. */
/** Product thumbnail + name, matching the Product Listings cell style. */
const ProductCell = ({
  name,
  image,
  children,
}: {
  name: string;
  image: string | null;
  children?: React.ReactNode;
}) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
      {image ? (
        <img src={image} alt={name} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
    <div className="min-w-0">
      <div className="font-medium truncate">{name}</div>
      {children}
    </div>
  </div>
);

const VariantMeta = ({
  brand,
  size,
  color,
}: {
  brand: string | null;
  size: string | null;
  color: string | null;
}) => {
  const parts = [brand, size, color].filter((v) => v && v.trim()) as string[];
  if (!parts.length) return null;
  return (
    <div className="md:hidden text-[11px] text-muted-foreground font-normal mt-0.5">
      {parts.join(" · ")}
    </div>
  );
};

const VendorInventory = () => {
  const navigate = useNavigate();
  const { vendor, loading: vendorLoading } = useVendor();
  const { bookings, replaceBooking } = useVendorBookings(vendor?.id);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  // status filter removed for MVP
  const [unitTab, setUnitTab] = useState<string>("available");
  const [activeTab, setActiveTab] = useState<string>("inventory");
  const [unitsForProduct, setUnitsForProduct] = useState<ProductRow | null>(null);
  const [detailUnitId, setDetailUnitId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<VendorBooking | null>(null);

  const load = async () => {
    if (!vendor) return;
    setLoading(true);
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, category, brand, size, color, sku, daily_rental_rate, is_active")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (products ?? []).map((p) => p.id);

      const [{ data: images }, { data: unitData }, { data: rateRows }] = await Promise.all([
        ids.length
          ? supabase.from("product_images").select("product_id, image_url, display_order").in("product_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase
              .from("product_units")
              // Archived (soft-deleted) units never appear in inventory counts.
              .select("id, product_id, serial_id, status, current_booking_id")
              .eq("is_active", true)
              .in("product_id", ids)

          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase
              .from("product_rental_rates")
              .select("product_id, rental_days, price")
              .in("product_id", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const imgMap = new Map<string, string>();
      (images ?? [])
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .forEach((i: any) => {
          if (!imgMap.has(i.product_id)) imgMap.set(i.product_id, i.image_url);
        });

      const productMap = new Map<string, any>();
      (products ?? []).forEach((p: any) => productMap.set(p.id, p));

      // Find any active booking linked to each unit via booking_items.
      // Don't trust product_units.current_booking_id alone — it may be stale.
      const unitIds = (unitData ?? []).map((u: any) => u.id);
      const { data: allItems } = unitIds.length
        ? await supabase
            .from("booking_items")
            .select("booking_id, product_unit_id, rental_price")
            .in("product_unit_id", unitIds)
        : { data: [] as any[] };

      const bookingIds = Array.from(
        new Set([
          ...((unitData ?? []).map((u: any) => u.current_booking_id).filter(Boolean) as string[]),
          ...((allItems ?? []).map((bi: any) => bi.booking_id).filter(Boolean) as string[]),
        ]),
      );

      const { data: bookings } = bookingIds.length
        ? await supabase
            .from("bookings")
            .select("id, customer_id, status, created_at")
            .in("id", bookingIds)
        : { data: [] as any[] };

      const bookingMap = new Map<string, any>();
      (bookings ?? []).forEach((b: any) => bookingMap.set(b.id, b));

      // Group items by unit, pick the most relevant booking:
      // 1) active (pending/fulfilment) > 2) for_review (completed+for_review) > 3) most recent
      const itemsByUnit = new Map<string, any[]>();
      (allItems ?? []).forEach((bi: any) => {
        if (!bi.product_unit_id) return;
        const arr = itemsByUnit.get(bi.product_unit_id) ?? [];
        arr.push(bi);
        itemsByUnit.set(bi.product_unit_id, arr);
      });

      const pickBookingForUnit = (unit: any): { booking: any | null; price: number | null } => {
        const items = itemsByUnit.get(unit.id) ?? [];
        const enriched = items
          .map((bi) => ({ bi, b: bookingMap.get(bi.booking_id) }))
          .filter((x) => x.b);
        if (!enriched.length) {
          // fallback to current_booking_id if it resolves
          const cb = unit.current_booking_id ? bookingMap.get(unit.current_booking_id) : null;
          return { booking: cb ?? null, price: null };
        }
        const active = enriched.find((x) => ACTIVE_BOOKING_STATUSES.has(x.b.status));
        if (active) return { booking: active.b, price: Number(active.bi.rental_price ?? 0) };
        const review = enriched.find(
          (x) =>
            (x.b.status === "for_review" || x.b.status === "completed") &&
            unit.status === "for_review",
        );
        if (review) return { booking: review.b, price: Number(review.bi.rental_price ?? 0) };
        const sorted = enriched
          .slice()
          .sort(
            (a, b) =>
              new Date(b.b.created_at ?? 0).getTime() -
              new Date(a.b.created_at ?? 0).getTime(),
          );
        return { booking: sorted[0]?.b ?? null, price: Number(sorted[0]?.bi.rental_price ?? 0) };
      };

      const unitRows: UnitRow[] = (unitData ?? []).map((u: any) => {
        const p = productMap.get(u.product_id);
        const { booking, price } = pickBookingForUnit(u);
        const bookingStatus: string | null = booking?.status ?? null;
        const showLink = !!booking && (
          ACTIVE_BOOKING_STATUSES.has(bookingStatus!) ||
          bookingStatus === "for_review" ||
          (bookingStatus === "completed" && u.status === "for_review")
        );
        return {
          id: u.id,
          serial_id: u.serial_id,
          status: u.status,
          displayStatus: deriveDisplayStatus(u.status, bookingStatus),
          product_id: u.product_id,
          product_name: p?.name ?? "—",
          primaryImage: imgMap.get(u.product_id) ?? null,
          brand: p?.brand ?? null,
          size: p?.size ?? null,
          color: p?.color ?? null,
          sku: skuOf(p),
          daily_rental_rate: Number(p?.daily_rental_rate ?? 0),
          current_booking_id: showLink ? booking.id : null,
          order_short: showLink ? formatBookingReference(booking.id) : null,
          customer_short: showLink ? shortId(booking.customer_id) : null,
          rent_price: price,
        };
      });

      const enriched: ProductRow[] = (products ?? []).map((p: any) => {
        const us = unitRows.filter((u) => u.product_id === p.id);
        const onRent = us.filter((u) =>
          [
            "pending_request",
            "waiting_payment",
            "payment_submitted",
            "reserved",
            "to_deliver",
            "on_delivery",
            "on_rent",
            "on_return",
          ].includes(u.displayStatus),
        ).length;
        const available = us.filter((u) => u.displayStatus === "available").length;
        // Group custom duration rates by product so we can compute the 1-day
        // starting price for the Product Listings column.
        const ratesByProduct = new Map<string, { rental_days: number; price: number }[]>();
        (rateRows ?? []).forEach((r: any) => {
          const arr = ratesByProduct.get(r.product_id) ?? [];
          arr.push({ rental_days: Number(r.rental_days), price: Number(r.price) });
          ratesByProduct.set(r.product_id, arr);
        });

        const startingPriceFor = (p: any): number | null => {
          const custom = findCustomRate(normalizeCustomRates(ratesByProduct.get(p.id) ?? null), 1);
          const daily = Math.max(0, Number(p.daily_rental_rate ?? 0) || 0);
          const value = custom != null ? custom : daily;
          return Number.isFinite(value) && value > 0 ? value : null;
        };

        return {
          id: p.id,
          name: p.name,
          category: p.category,
          brand: p.brand ?? null,
          size: p.size ?? null,
          color: p.color ?? null,
          daily_rental_rate: Number(p.daily_rental_rate ?? 0),
          startingPrice: startingPriceFor(p),
          is_active: p.is_active,
          primaryImage: imgMap.get(p.id) ?? null,
          sku: skuOf(p),
          total: us.length,
          available,
          onRent,
        };
      });
      setRows(enriched);
      setUnits(unitRows);
    } catch (e: any) {
      toast({ title: "Failed to load inventory", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendor) load();
  }, [vendor?.id]);

  useEffect(() => {
    if (!vendor) return;
    return onBookingsChanged(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id]);

  // Full store totals — independent of search/category filters.
  const storeTotals = useMemo(() => {
    const totalUnits = rows.reduce((s, p) => s + p.total, 0);
    const totalSkus = rows.length;
    const availableUnits = rows.reduce((s, p) => s + p.available, 0);
    return { totalUnits, totalSkus, availableUnits };
  }, [rows]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.name, r.sku, r.brand, r.size, r.color];
        if (!hay.some((f) => (f ?? "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, search, category]);

  // ---------------------------------------------------------------------
  // Process tabs are BOOKING-ITEM based: one physical unit may carry several
  // future, non-overlapping bookings, so the same serial can appear in more
  // than one row/tab. product_units.current_booking_id is never the source.
  // ---------------------------------------------------------------------
  const processRows = useMemo<StatusRow[]>(() => {
    const attrs = new Map(rows.map((r) => [r.id, r]));
    const out: StatusRow[] = [];
    bookings.forEach((b) => {
      const tab = tabForBookingStatus(b.status);
      if (!tab) return;
      b.items.forEach((it) => {
        const p = it.productId ? attrs.get(it.productId) : undefined;
        out.push({
          key: it.id,
          unitId: it.productUnitId ?? null,
          serial: it.serial ?? "—",
          productName: it.productName,
          primaryImage: p?.primaryImage ?? null,
          brand: p?.brand ?? null,
          size: p?.size ?? null,
          color: p?.color ?? null,
          sku: skuOf(p),
          tab,
          orderShort: formatBookingReference(b.id),
          customerShort: shortId(b.customer.id),
          rentalStart: b.rentalStart,
          booking: b,
        });
      });
    });
    return out.sort((a, b) => (a.rentalStart < b.rentalStart ? -1 : a.rentalStart > b.rentalStart ? 1 : 0));
  }, [bookings, rows]);

  // Units physically committed to a booking right now (fulfilment lifecycle).
  const occupiedUnitIds = useMemo(() => {
    const s = new Set<string>();
    bookings.forEach((b) => {
      if (!PHYSICAL_LIFECYCLE_SET.has(b.status)) return;
      b.items.forEach((it) => it.productUnitId && s.add(it.productUnitId));
    });
    return s;
  }, [bookings]);

  // "Available" stays unit-based: active, unit status available, and not
  // physically held by an in-progress booking.
  const isTrulyAvailable = (u: UnitRow) =>
    u.status === "available" && !occupiedUnitIds.has(u.id);

  const matchesSearch = (...fields: (string | null | undefined)[]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return fields.some((f) => (f ?? "").toLowerCase().includes(q));
  };

  const availableUnits = useMemo(
    () =>
      units.filter(
        (u) =>
          isTrulyAvailable(u) &&
          matchesSearch(u.product_name, u.sku, u.serial_id, u.brand, u.size, u.color),
      ),
    [units, search, occupiedUnitIds],
  );

  const filteredProcessRows = useMemo(
    () =>
      processRows.filter(
        (r) =>
          r.tab === unitTab &&
          matchesSearch(r.productName, r.sku, r.serial, r.orderShort, r.brand, r.size, r.color),
      ),
    [processRows, unitTab, search],
  );

  const tabCounts = useMemo(() => {
    const m: Record<string, number> = { available: units.filter(isTrulyAvailable).length };
    for (const t of STATUS_TABS) {
      if (t.key === "available") continue;
      m[t.key] = processRows.filter((r) => r.tab === t.key).length;
    }
    return m;
  }, [units, processRows, occupiedUnitIds]);


  // Product-level archive = hide the WHOLE listing. It is never a way to
  // reduce quantity by one unit (use View units → Archive unit for that).
  const toggleArchive = async (p: ProductRow) => {
    if (p.is_active) {
      const hasActiveBooking = units.some(
        (u) => u.product_id === p.id && !!u.current_booking_id,
      );
      if (hasActiveBooking) {
        toast({
          title: "Can't archive product",
          description: "This product has active bookings and cannot be archived yet.",
          variant: "destructive",
        });
        return;
      }
    }
    const { error } = await supabase
      .from("products")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: p.is_active ? "Product archived" : "Product restored" });
    load();
  };


  if (vendorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-card border border-border rounded-2xl p-8">
          <h2 className="text-xl font-semibold">No vendor store found</h2>
          <p className="text-sm text-muted-foreground mt-2">Set up your store to manage inventory.</p>
          <Button asChild className="mt-4"><Link to="/vendor/signup">Set up store</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <VendorTopBar storeName={vendor.store_name} />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage your store's product listings&nbsp;</p>
          </div>
          {activeTab === "listings" ? (
            <Button onClick={() => navigate("/vendor/inventory/new")}>
              <Plus className="w-4 h-4" /> Add New Product
            </Button>
          ) : (
            <div className="hidden md:block w-[160px]" aria-hidden />
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="inventory">Item Status</TabsTrigger>
            <TabsTrigger value="listings">Product Listings</TabsTrigger>
          </TabsList>

          {/* INVENTORY TAB — units grouped by process status */}
          <TabsContent value="inventory" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
              {/* Subtabs */}
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                {STATUS_TABS.map((t) => {
                  const active = unitTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setUnitTab(t.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors border",
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {t.label}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        active ? "bg-background/20" : "bg-muted"
                      )}>
                        {tabCounts[t.key] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative max-w-md mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by serial, product, brand, size, color, SKU, order…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground tracking-wide">
                    <tr className="border-b border-border">
                      <th className="text-left font-medium py-3 px-2 whitespace-nowrap">Serial ID</th>
                      <th className="text-left font-medium py-3 px-2">Product Name</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">Brand</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">Size</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">Color</th>
                      <th className="text-left font-medium py-3 px-2 whitespace-nowrap">SKU</th>
                      <th className="text-left font-medium py-3 px-2">Status</th>
                      <th className="text-left font-medium py-3 px-2 whitespace-nowrap">Order ID</th>
                      <th className="text-left font-medium py-3 px-2 whitespace-nowrap">Customer ID</th>
                      <th className="text-right font-medium py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading units…</td></tr>
                    )}
                    {!loading && unitTab === "available" && availableUnits.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-muted-foreground">
                          No units in this category.
                        </td>
                      </tr>
                    )}
                    {!loading && unitTab === "available" && availableUnits.map((u) => (
                      <tr key={u.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap">{u.serial_id}</td>
                        <td className="py-3 px-2 font-medium">
                          <ProductCell name={u.product_name} image={u.primaryImage}>
                            <VariantMeta brand={u.brand} size={u.size} color={u.color} />
                          </ProductCell>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(u.brand)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(u.size)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(u.color)}</td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap">{u.sku}</td>
                        <td className="py-3 px-2"><StatusBadge status="available" /></td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">—</td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">—</td>
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setDetailUnitId(u.id)}
                          >
                            <Eye className="w-4 h-4" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!loading && unitTab !== "available" && filteredProcessRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-muted-foreground">
                          No units in this category.
                        </td>
                      </tr>
                    )}
                    {!loading && unitTab !== "available" && filteredProcessRows.map((r) => (
                      <tr key={r.key} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap">{r.serial}</td>
                        <td className="py-3 px-2 font-medium">
                          <ProductCell name={r.productName} image={r.primaryImage}>
                            <VariantMeta brand={r.brand} size={r.size} color={r.color} />
                          </ProductCell>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(r.brand)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(r.size)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(r.color)}</td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap">{r.sku}</td>
                        <td className="py-3 px-2"><StatusBadge status={r.tab} /></td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{r.orderShort}</td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{r.customerShort}</td>
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            // Always opens the booking of THIS row, never
                            // product_units.current_booking_id.
                            onClick={() => setSelectedBooking(r.booking)}
                          >
                            <Eye className="w-4 h-4" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* LISTINGS TAB — products catalog (unchanged) */}
          <TabsContent value="listings" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
              {/* Store totals — full inventory, unaffected by search/filter */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                <div className="border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground">Total Units</div>
                  <div className="text-2xl font-semibold mt-1">{storeTotals.totalUnits}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">All physical inventory units</div>
                </div>
                <div className="border border-border rounded-xl p-4">
                  <div className="text-xs text-muted-foreground">Total SKUs</div>
                  <div className="text-2xl font-semibold mt-1">{storeTotals.totalSkus}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Unique product listings</div>
                </div>
                <div className="border border-border rounded-xl p-4 col-span-2 md:col-span-1">
                  <div className="text-xs text-muted-foreground">Available Units</div>
                  <div className="text-2xl font-semibold mt-1 text-emerald-600">{storeTotals.availableUnits}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Ready to rent</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by product, brand, size, color or SKU…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="md:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground tracking-wide">
                    <tr className="border-b border-border">
                      <th className="text-left font-medium py-3 px-2">Product</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">Brand</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">Size</th>
                      <th className="text-left font-medium py-3 px-2 hidden md:table-cell">Color</th>
                      <th className="text-left font-medium py-3 px-2 whitespace-nowrap">SKU</th>
                      <th className="text-left font-medium py-3 px-2">Category</th>
                      <th className="text-right font-medium py-3 px-2">Total</th>
                      <th className="text-right font-medium py-3 px-2">Available</th>
                      <th className="text-right font-medium py-3 px-2">On Rent</th>
                      <th className="text-right font-medium py-3 px-2">Starting Price</th>
                      <th className="text-right font-medium py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">Loading products…</td></tr>
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-muted-foreground">
                          {rows.length === 0 ? "No products yet. Add your first product to get started." : "No products match your filters."}
                        </td>
                      </tr>
                    )}
                    {!loading && filtered.map((p) => (
                      <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                              {p.primaryImage ? (
                                <img src={p.primaryImage} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No img</span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{p.name}</div>
                              <VariantMeta brand={p.brand} size={p.size} color={p.color} />
                              {!p.is_active && <div className="text-[11px] text-muted-foreground">Archived</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(p.brand)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(p.size)}</td>
                        <td className="py-3 px-2 hidden md:table-cell">{dash(p.color)}</td>
                        <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap">{p.sku}</td>
                        <td className="py-3 px-2 text-muted-foreground">{p.category ?? "—"}</td>
                        <td className="py-3 px-2 text-right">{p.total}</td>
                        <td className="py-3 px-2 text-right">
                          <span className={p.available > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                            {p.available}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">{p.onRent}</td>
                        <td className="py-3 px-2 text-right font-medium">
                          {p.startingPrice != null ? `From ${fmtTHB(p.startingPrice)}` : "—"}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => setUnitsForProduct(p)}>
                                <Eye className="w-4 h-4" /> View units
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/vendor/inventory/${p.id}/edit`)}>
                                <Pencil className="w-4 h-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleArchive(p)}>
                                {p.is_active ? <><Archive className="w-4 h-4" /> Archive</> : <><ArchiveRestore className="w-4 h-4" /> Restore</>}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <ProductUnitsDialog
        productId={unitsForProduct?.id ?? null}
        productName={unitsForProduct?.name ?? ""}
        sku={unitsForProduct?.sku ?? ""}
        open={!!unitsForProduct}
        onClose={() => setUnitsForProduct(null)}
        onChanged={load}
        onViewOrder={(unitId) => setDetailUnitId(unitId)}

      />
      <UnitDetailDialog
        unitId={detailUnitId}
        open={!!detailUnitId}
        onClose={() => setDetailUnitId(null)}
        onChanged={load}
      />
      <OrderDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onUpdated={(b) => {
          replaceBooking(b);
          setSelectedBooking(b);
          load();
        }}
      />
    </div>
  );
};

export default VendorInventory;
