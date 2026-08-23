import { formatDateForDatabase, parseDatabaseDate } from "@/lib/date-utils";
import { scopedKey } from "@/lib/user-scope";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarIcon, Info, Truck, Bike, ShieldCheck, Clock, ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { addToBag, replaceBag, BAG_LIMIT_MESSAGE, type BagItem } from "@/lib/bag-store";
import { supabase } from "@/integrations/supabase/client";
import {
  THAI_PROVINCES,
  BANGKOK,
  type DeliveryMethod,
  earliestStartDate,
  rentalDays,
  isValidRentalDuration,
  EMS_ONE_DAY_MESSAGE,
  deliveryMethodLabel,
  PARCEL_DELIVERY_HELPER,
  PARCEL_DELIVERY_HELPER_EXTRA,
  MESSENGER_HELPER,
  resolveDeliveryOptions,
  computeLifecycle,
  lifecycleBlockedDates,
  vendorResponseDeadline,
  computePricing,
  startOfDay,
  addDays,
  fmtDate,
} from "@/lib/booking-logic";
import {
  getRentalSubtotal,
  getStartingPrice,
  isCustomPriced,
  normalizeCustomRates,
  type CustomRentalRate,
} from "@/lib/pricing";

import {
  isProductAvailableForDateRange,
  findAvailableUnitForDateRange,
  type BookingLike,
  type ProductUnitLike,
} from "@/lib/availability";
import { onBookingsChanged } from "@/lib/sync";
import { RentalPolicyModal } from "@/components/customer/RentalPolicyModal";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&h=1200&fit=crop&q=80";

interface RealProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  dailyRate: number;
  /** Optional custom duration prices (fallback = dailyRate × days). */
  customRates: CustomRentalRate[];
  minDays: number;

  maxDays: number;
  images: string[];
  vendorId: string;
  storeName: string;
  rentalPolicy: string | null;
  rentalPolicyImages: string[];

  vendorDepositPerItem: number;
  unitsTotal: number;
  /** All physical units of this product (id only — status is vendor-side). */
  units: ProductUnitLike[];
  /** Existing bookings touching those units (availability is date-based). */
  bookings: BookingLike[];
}

// Drafts are namespaced per authenticated user so a previous account's form
// values can never prefill the next account's booking form.
const DRAFT_KEY = (id: string) => scopedKey("roop:booking-draft:", id);


interface BookingDraft {
  province: string;
  address: string;
  startDate?: string;
  endDate?: string;
  deliveryMethod: DeliveryMethod | "";
}

const Booking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [product, setProduct] = useState<RealProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selections
  const [selectedImage, setSelectedImage] = useState(0);

  // Booking
  const [province, setProvince] = useState<string>("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [existingBagItem, setExistingBagItem] = useState<BagItem | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  // Bumped whenever booking data changes anywhere in the app (e.g. a vendor
  // cancels a booking) so blocked dates are refetched instead of going stale.
  const [availabilityTick, setAvailabilityTick] = useState(0);

  useEffect(() => onBookingsChanged(() => setAvailabilityTick((t) => t + 1)), []);

  // Fetch real product
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      if (availabilityTick === 0) setLoadingProduct(true);
      setLoadError(null);
      try {
        const { data: p, error } = await supabase
          .from("products")
          .select(`
            id, name, description, category, brand, color, size,
            daily_rental_rate, deposit_amount, min_rental_days, max_rental_days, is_active,
            vendor_id,
            product_images ( image_url, display_order ),
            product_rental_rates ( rental_days, price )

          `)
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;

        // Store info and unit list come from the safe public views: no vendor
        // contact/banking data and no unit serial numbers are exposed here.
        const [{ data: vendorRow }, { data: unitRows }] = await Promise.all([
          p?.vendor_id
            ? supabase
                .from("vendors_public")
                .select("id, store_name, deposit_per_item, is_active, rental_details_policy, rental_policy_image_urls")
                .eq("id", p.vendor_id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          p?.id
            ? supabase
                .from("product_units_public")
                .select("id, product_id, status")
                .eq("product_id", p.id)
            : Promise.resolve({ data: [] as any[] } as any),
        ]);

        if (!p || !p.is_active || !(vendorRow as any)?.is_active) {
          if (!cancelled) setLoadError("This product isn't available right now.");
          return;
        }

        const v: any = vendorRow;
        const sortedImages = ((p.product_images as any[]) ?? [])
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((i) => i.image_url)
          .filter(Boolean);

        // The public view only returns active (non-archived) units.
        const units: ProductUnitLike[] = ((unitRows as any[]) ?? []).map((u) => ({
          id: u.id,
          product_id: p.id,
        }));


        // Fetch existing bookings that touch any unit of this product. Availability
        // is decided by date overlap (see src/lib/availability.ts), not unit status.
        // NOTE: booking_items/bookings are RLS-protected (own bookings only), so a
        // different shopper would see zero rows. We use a security-definer RPC that
        // returns ONLY unit id + status + rental dates (no customer data).
        const unitIds = units.map((u) => u.id);
        let bookings: BookingLike[] = [];
        if (unitIds.length) {
          const { data: rows, error: rpcErr } = await supabase.rpc(
            "get_product_unit_blocked_bookings",
            { _product_id: p.id },
          );
          if (rpcErr) console.warn("[availability] rpc error:", rpcErr);
          bookings = (rows ?? []).map((r: any) => ({
            id: r.booking_id,
            status: r.status,
            rental_start: r.rental_start,
            rental_end: r.rental_end,
            delivery_method: r.delivery_method,
            province: r.delivery_province,
            product_unit_ids: [r.product_unit_id],
          }));
          if (import.meta.env.DEV) {
            console.log("[availability] product", p.id, {
              activeUnitIds: unitIds,
              blockingBookings: bookings,
            });
          }
        }


        if (cancelled) return;
        setProduct({
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          category: p.category ?? "",
          brand: (p as any).brand ?? null,
          color: p.color ?? null,
          size: p.size ?? null,
          dailyRate: Number(p.daily_rental_rate ?? 0),
          customRates: normalizeCustomRates((p as any).product_rental_rates),

          minDays: Number((p as any).min_rental_days ?? 1),
          maxDays: Number((p as any).max_rental_days ?? 30),
          images: sortedImages.length ? sortedImages : [FALLBACK_IMAGE],
          vendorId: v.id,
          storeName: v.store_name,
          rentalPolicy: (v as any).rental_details_policy ?? null,
          rentalPolicyImages: ((v as any).rental_policy_image_urls as string[] | null) ?? [],

          vendorDepositPerItem: Number((p as any).deposit_amount ?? v.deposit_per_item ?? 0),
          unitsTotal: units.length,
          units,
          bookings,
        });
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "Failed to load product.");
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, availabilityTick]);

  // Restore draft on mount AND whenever the authenticated user changes.
  // Any in-memory values from a previous identity are wiped first.
  useEffect(() => {
    if (!id) return;
    if (authLoading) return;
    setProvince("");
    setAddress("");
    setStartDate(undefined);
    setEndDate(undefined);
    setDeliveryMethod("");
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(id));
      if (!raw) return;
      const d = JSON.parse(raw) as BookingDraft;
      if (d.province) setProvince(d.province);
      if (d.address) setAddress(d.address);
      if (d.startDate) setStartDate(parseDatabaseDate(d.startDate));
      if (d.endDate) setEndDate(parseDatabaseDate(d.endDate));
      if (d.deliveryMethod) setDeliveryMethod(d.deliveryMethod);
    } catch {
      // ignore
    }
  }, [id, user?.id, authLoading]);


  const now = useMemo(() => new Date(), []);
  const earliest = useMemo(
    () => earliestStartDate(now, undefined, province || undefined, deliveryMethod || undefined),
    [now, province, deliveryMethod],
  );

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return rentalDays(startDate, endDate);
  }, [startDate, endDate]);

  const durationValid =
    !!province &&
    days > 0 &&
    isValidRentalDuration(province, days, deliveryMethod || undefined) &&
    (!product || (days >= product.minDays && days <= product.maxDays));

  const emsOneDayBlocked =
    province === BANGKOK && deliveryMethod === "EMS" && days > 0 && days < 2;

  const { options: deliveryOptions, fixed: deliveryFixed } = useMemo(
    () => resolveDeliveryOptions(province),
    [province],
  );

  useEffect(() => {
    if (deliveryOptions.length === 0) {
      setDeliveryMethod("");
      return;
    }
    if (deliveryFixed) {
      setDeliveryMethod(deliveryOptions[0]);
    } else if (deliveryMethod && !deliveryOptions.includes(deliveryMethod as DeliveryMethod)) {
      setDeliveryMethod("");
    }
  }, [deliveryOptions, deliveryFixed]);

  useEffect(() => {
    if (!province) return;
    if (startDate && startOfDay(startDate) < startOfDay(earliest)) {
      setStartDate(undefined);
      setEndDate(undefined);
      return;
    }
    if (
      startDate &&
      endDate &&
      !isValidRentalDuration(province, rentalDays(startDate, endDate), deliveryMethod || undefined)
    ) {
      setEndDate(undefined);
    }
  }, [province, earliest, deliveryMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  const lifecyclePreview = useMemo(() => {
    if (!startDate || !endDate || !deliveryMethod || !province) return null;
    return computeLifecycle(startDate, endDate, deliveryMethod as DeliveryMethod, province);
  }, [startDate, endDate, deliveryMethod, province]);

  const pricing = useMemo(() => {
    const rentalTotal = getRentalSubtotal(
      { dailyRate: product?.dailyRate ?? 0, customRates: product?.customRates },
      days,
    );
    const depositTotal = Math.max(0, product?.vendorDepositPerItem ?? 0);
    return { rentalTotal, depositTotal, grandTotal: rentalTotal + depositTotal };
  }, [product?.dailyRate, product?.customRates, days, product?.vendorDepositPerItem]);

  const startingPrice = useMemo(
    () =>
      product
        ? getStartingPrice({ dailyRate: product.dailyRate, customRates: product.customRates })
        : null,
    [product?.dailyRate, product?.customRates],
  );

  const rentalIsCustom = useMemo(
    () => isCustomPriced({ dailyRate: product?.dailyRate ?? 0, customRates: product?.customRates }, days),
    [product?.dailyRate, product?.customRates, days],
  );


  // A calendar day is blocked only when NO unit of the product is free that day
  // (date-overlap based, via the shared availability helper).
  const isDayFullyBooked = useMemo(() => {
    const cache = new Map<number, boolean>();
    return (date: Date) => {
      if (!product || product.units.length === 0) return false;
      const key = startOfDay(date).getTime();
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const free = isProductAvailableForDateRange({
        productId: product.id,
        selectedStartDate: date,
        selectedEndDate: date,
        productUnits: product.units,
        existingBookings: product.bookings,
      });
      cache.set(key, !free);
      return !free;
    };
  }, [product]);

  const isBlockedByOthers = (date: Date) => isDayFullyBooked(date);

  const disabledStart = (date: Date) =>
    startOfDay(date) < startOfDay(earliest) || isBlockedByOthers(date);

  const disabledEnd = (date: Date) => {
    if (!startDate) return true;
    const d = startOfDay(date);
    if (d < startOfDay(startDate)) return true;
    if (!province) return true;
    const candidateDays = rentalDays(startDate, date);
    if (!isValidRentalDuration(province, candidateDays, deliveryMethod || undefined)) return true;
    if (product && (candidateDays < product.minDays || candidateDays > product.maxDays)) return true;
    // The whole selected range must be servable by at least one single unit.
    if (
      product &&
      product.units.length > 0 &&
      !isProductAvailableForDateRange({
        productId: product.id,
        selectedStartDate: startDate,
        selectedEndDate: date,
        productUnits: product.units,
        existingBookings: product.bookings,
      })
    ) {
      return true;
    }
    return false;
  };

  // Product has physical units at all (vendor operational status is not used here).
  const productAvailable = !!product && product.unitsTotal > 0;

  // The unit that will serve the currently selected range, if any.
  const assignedUnit = useMemo(() => {
    if (!product || !startDate || !endDate) return null;
    return findAvailableUnitForDateRange({
      productId: product.id,
      selectedStartDate: startDate,
      selectedEndDate: endDate,
      productUnits: product.units,
      existingBookings: product.bookings,
    });
  }, [product, startDate, endDate]);

  const datesAvailable = !startDate || !endDate || !product || !!assignedUnit;

  const canSubmit =
    !!product &&
    productAvailable &&
    datesAvailable &&
    !!province &&
    !!startDate &&
    !!endDate &&
    durationValid &&
    !!deliveryMethod &&
    address.trim().length > 5;

  const persistDraft = () => {
    if (!id) return;
    const draft: BookingDraft = {
      province,
      address,
      startDate: startDate ? formatDateForDatabase(startDate) : undefined,
      endDate: endDate ? formatDateForDatabase(endDate) : undefined,
      deliveryMethod,
    };
    sessionStorage.setItem(DRAFT_KEY(id), JSON.stringify(draft));
  };

  const buildBagItem = (): BagItem => ({
    id: `${product!.id}-${Date.now()}`,
    productId: product!.id,
    productName: product!.name,
    productImage: product!.images[0],
    vendorId: product!.vendorId,
    vendorName: product!.storeName,
    vendorDepositPerItem: product!.vendorDepositPerItem,
    color: product!.color ?? "",
    size: product!.size ?? "",
    province,
    address,
    startDate: formatDateForDatabase(startDate!),
    endDate: formatDateForDatabase(endDate!),
    days,
    dailyRate: product!.dailyRate,
    rentalTotal: pricing.rentalTotal,
    depositTotal: pricing.depositTotal,
    deliveryMethod: deliveryMethod as DeliveryMethod,
    // Unit chosen by the date-based availability helper.
    productUnitId: assignedUnit?.id,
    addedAt: new Date().toISOString(),
  });

  const handleSubmit = () => {
    if (!product) return;
    if (adding) return; // guard rapid double-clicks
    if (emsOneDayBlocked) {
      toast({
        title: "Minimum rental not met",
        description: EMS_ONE_DAY_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (startDate && endDate && !datesAvailable) {
      toast({
        title: "Dates unavailable",
        description:
          "This item is unavailable for the selected dates. Please choose another date range.",
        variant: "destructive",
      });
      return;
    }
    if (!canSubmit) {
      toast({
        title: "Missing details",
        description: "Please complete all required fields before sending the request.",
      });
      return;
    }
    if (authLoading) return;
    if (!user) {
      persistDraft();
      setSubmitOpen(true);
      return;
    }
    setAdding(true);
    const result = addToBag(buildBagItem());
    if (result.ok === false) {
      setExistingBagItem(result.existing);
      setLimitOpen(true);
      setAdding(false);
      return;
    }
    // Persist the entered fields so returning from the bag restores them.
    persistDraft();
    navigate("/bag");
  };

  const replaceBagItem = () => {
    if (!product) return;
    replaceBag(buildBagItem());
    setLimitOpen(false);
    persistDraft();
    navigate("/bag");
  };


  const goToAuth = (mode: "login" | "signup") => {
    persistDraft();
    navigate(`/auth?mode=${mode}&redirect=${encodeURIComponent(`/booking/${id}`)}`);
  };

  const deadline = useMemo(() => vendorResponseDeadline(new Date()), []);

  if (loadingProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading product…
      </div>
    );
  }
  if (loadError || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>{loadError ?? "Product not found."}</p>
        <Button variant="outline" onClick={() => navigate("/explore")}>Back to marketplace</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container-main flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/explore")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 -ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Back to marketplace"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to marketplace</span>
            </button>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground uppercase">
            ROOP
          </span>
        </div>
      </header>

      <main className="container-main py-8 md:py-12">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14">
          <section>
            <div className="aspect-[3/4] bg-muted-foreground/5 rounded-2xl overflow-hidden mb-3 flex items-center justify-center">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mb-8">
                {product.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden bg-muted ring-offset-background transition-all",
                      i === selectedImage
                        ? "ring-2 ring-foreground ring-offset-2"
                        : "opacity-70 hover:opacity-100",
                    )}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {product.storeName}
            </p>
            <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-2">
              {product.name}
            </h1>
            <p className="text-lg text-foreground mb-2">
              <span className="text-sm text-muted-foreground">Starting from </span>
              {startingPrice != null ? `฿${startingPrice.toLocaleString()}` : "Price unavailable"}
            </p>
            {product.customRates.length > 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                Package prices:{" "}
                {product.customRates
                  .map((r) => `${r.rental_days} day${r.rental_days > 1 ? "s" : ""} ฿${r.price.toLocaleString()}`)
                  .join(" · ")}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-8 text-xs text-muted-foreground">
              {product.category && (
                <span className="px-2 py-0.5 rounded-full bg-muted">{product.category}</span>
              )}
              {product.brand && (
                <span className="px-2 py-0.5 rounded-full bg-muted">{product.brand}</span>
              )}
              {product.color && (
                <span className="px-2 py-0.5 rounded-full bg-muted">{product.color}</span>
              )}
              {product.size && (
                <span className="px-2 py-0.5 rounded-full bg-muted">Size {product.size}</span>
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full",
                  productAvailable
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {productAvailable
                  ? `${product.unitsTotal} unit${product.unitsTotal > 1 ? "s" : ""} — pick your dates`
                  : "Currently unavailable"}
              </span>
            </div>

            <div>
              <h2 className="text-sm font-medium text-foreground mb-2">Description</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description || "No description provided."}
              </p>
            </div>

            {product.rentalPolicy?.trim() || product.rentalPolicyImages.length ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium text-foreground">Rental Details & Policy</h2>
                    <p className="text-xs text-muted-foreground">Provided by {product.storeName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 text-xs"
                    onClick={() => setPolicyOpen(true)}
                  >
                    View full policy
                  </Button>
                </div>

                {product.rentalPolicy?.trim() ? (
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-line">
                    {product.rentalPolicy}
                  </p>
                ) : null}

                {product.rentalPolicyImages.length > 0 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {product.rentalPolicyImages.slice(0, 3).map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative shrink-0"
                      >
                        <img
                          src={url}
                          alt={`${product.storeName} rental policy ${idx + 1}`}
                          loading="lazy"
                          className="h-16 w-16 rounded-lg border border-border object-cover"
                        />
                      </a>
                    ))}
                    {product.rentalPolicyImages.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setPolicyOpen(true)}
                        className="relative shrink-0 h-16 w-16 rounded-lg border border-border bg-muted flex items-center justify-center text-xs font-medium text-foreground hover:bg-muted/70 transition"
                      >
                        +{product.rentalPolicyImages.length - 3} more
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <RentalPolicyModal
              open={policyOpen}
              onOpenChange={setPolicyOpen}
              storeName={product.storeName}
              policyText={product.rentalPolicy}
              policyImages={product.rentalPolicyImages}
            />

          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-6 md:p-7 shadow-sm">
              <h2 className="text-lg font-medium text-foreground mb-1">Reserve this piece</h2>
              <p className="text-xs text-muted-foreground mb-1">
                {province && deliveryMethod ? (
                  <>
                    Earliest available: <span className="text-foreground">{fmtDate(earliest)}</span>
                  </>
                ) : (
                  "Select delivery province and method first"
                )}
              </p>

              <p className="text-xs text-muted-foreground mb-6">
                Rental window: {product.minDays}–{product.maxDays} days
              </p>

              <div className="mb-4">
                <Label className="text-xs font-medium text-foreground mb-1.5 block">
                  Delivery province <span className="text-destructive">*</span>
                </Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {THAI_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mb-4">
                <Label className="text-xs font-medium text-foreground mb-1.5 block">
                  Preferred Address <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, building, postal code…"
                  rows={2}
                  className="resize-none bg-background"
                  maxLength={500}
                />
              </div>

              {deliveryOptions.length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs font-medium text-foreground mb-1.5 block">
                    Delivery method <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Messenger", "EMS"] as DeliveryMethod[]).map((m) => {
                      const available = deliveryOptions.includes(m);
                      const active = deliveryMethod === m;
                      return (
                        <button
                          key={m}
                          disabled={!available || deliveryFixed}
                          onClick={() => setDeliveryMethod(m)}
                          className={cn(
                            "flex items-center gap-2 h-11 px-3 rounded-lg border text-sm transition-all",
                            active
                              ? "bg-foreground text-background border-foreground"
                              : "bg-background text-foreground border-border hover:border-foreground",
                            (!available || (deliveryFixed && !active)) &&
                              "opacity-40 cursor-not-allowed hover:border-border",
                          )}
                        >
                          {m === "Messenger" ? (
                            <Bike className="w-4 h-4" />
                          ) : (
                            <Truck className="w-4 h-4" />
                          )}
                          {deliveryMethodLabel(m)}
                        </button>
                      );
                    })}
                  </div>
                  {deliveryFixed && deliveryMethod ? (
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      <span className="font-bold text-destructive">
                        Parcel Delivery only for delivery outside Bangkok
                      </span>
                    </p>
                  ) : !deliveryMethod ? (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Choose a delivery method to unlock the calendar.
                    </p>
                  ) : null}
                  {deliveryMethod === "EMS" ? (
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                      {PARCEL_DELIVERY_HELPER}
                      <br />
                      <span className="opacity-80">{PARCEL_DELIVERY_HELPER_EXTRA}</span>
                    </p>
                  ) : deliveryMethod === "Messenger" ? (
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                      {MESSENGER_HELPER}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <DatePickerField
                  label="Start date"
                  value={startDate}
                  onChange={(d) => {
                    setStartDate(d);
                    if (endDate && d && endDate < d) setEndDate(undefined);
                  }}
                  placeholder={!province ? "Select province first" : !deliveryMethod ? "Pick method first" : "Pick date"}
                  disabled={disabledStart}
                  fromDate={earliest}
                  isDisabledTrigger={!province || !deliveryMethod}
                />
                <DatePickerField
                  label="Last rental date"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder={!startDate ? "Pick start first" : "Pick date"}
                  disabled={disabledEnd}
                  fromDate={startDate ?? earliest}
                  isDisabledTrigger={!startDate || !province || !deliveryMethod}
                />
              </div>

              {province && days > 0 && (
                <p
                  className={cn(
                    "text-xs mb-4 -mt-1",
                    durationValid ? "text-muted-foreground" : "text-destructive",
                  )}
                >
                  {durationValid
                    ? `${days} ${days === 1 ? "day" : "days"} rental`
                    : days < product.minDays
                      ? `Minimum ${product.minDays} day${product.minDays > 1 ? "s" : ""} for this item`
                      : days > product.maxDays
                        ? `Maximum ${product.maxDays} days for this item`
                        : emsOneDayBlocked
                          ? EMS_ONE_DAY_MESSAGE
                          : province === BANGKOK
                            ? "Minimum 1 day rental in Bangkok"
                            : "Minimum 2 days rental outside Bangkok"}
                </p>
              )}


              {lifecyclePreview && durationValid && (
                <div className="mb-5 rounded-lg border border-border bg-muted/40 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-background/60">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Rental timeline
                    </span>
                  </div>
                  <div className="p-3 text-[11px] text-muted-foreground space-y-1.5">
                    {lifecyclePreview.shipOut && (
                      <div className="flex justify-between">
                        <span>Vendor ships out (by 12 PM)</span>
                        <span className="text-foreground">{fmtDate(lifecyclePreview.shipOut)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Rental period</span>
                      <span className="text-foreground">
                        {fmtDate(lifecyclePreview.rentalStart)}
                        {lifecyclePreview.lastRentalDate.getTime() !== lifecyclePreview.rentalStart.getTime()
                          ? ` → ${fmtDate(lifecyclePreview.lastRentalDate)}`
                          : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Return by 12 PM</span>
                      <span className="text-foreground">{fmtDate(lifecyclePreview.actualReturn)}</span>
                    </div>


                    {lifecyclePreview.storeReceive && (
                      <div className="flex justify-between">
                        <span>Vendor receives</span>
                        <span className="text-foreground">{fmtDate(lifecyclePreview.storeReceive)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Cleaning ({lifecyclePreview.cleaning.length}d)</span>
                      <span className="text-foreground">
                        {fmtDate(lifecyclePreview.cleaning[0])}
                        {lifecyclePreview.cleaning.length > 1
                          ? ` → ${fmtDate(lifecyclePreview.cleaning[lifecyclePreview.cleaning.length - 1])}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-2 mb-4">
                <Row
                  label={`Rental ${
                    days > 0
                      ? rentalIsCustom
                        ? `(${days}-day package price)`
                        : `(${days} × ฿${product.dailyRate.toLocaleString()})`
                      : ""
                  }`}

                  value={pricing.rentalTotal}
                />
                <Row label="Refundable deposit" value={pricing.depositTotal} muted />
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm font-medium text-foreground">Total today</span>
                  <span className="text-lg font-semibold text-foreground">
                    ฿{pricing.grandTotal.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="font-bold text-destructive">
                    Delivery fee will be calculated and confirmed later by the vendor.
                  </span>
                </p>
              </div>

              {!datesAvailable && (
                <p className="mb-3 text-xs font-medium text-destructive">
                  This item is unavailable for the selected dates. Please choose another date
                  range.
                </p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || adding}
                className="w-full h-12 rounded-lg text-sm font-medium"
              >
                {!productAvailable
                  ? "Currently Unavailable"
                  : !datesAvailable
                    ? "Dates Unavailable"
                    : adding
                      ? "Adding…"
                      : "Send Booking Request"}
              </Button>


              <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
                <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
                No charge until the vendor confirms your request. Vendor will respond by{" "}
                <span className="text-foreground">
                  {deadline.toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                .
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in to continue</DialogTitle>
            <DialogDescription>
              Create an account or sign in to send your booking request to{" "}
              <span className="text-foreground">{product.storeName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button className="h-11" onClick={() => goToAuth("signup")}>
              Create an account
            </Button>
            <Button variant="outline" className="h-11" onClick={() => goToAuth("login")}>
              I already have an account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>One item per rental request</DialogTitle>
            <DialogDescription>
              {BAG_LIMIT_MESSAGE}
              {existingBagItem ? (
                <span className="block mt-2 text-foreground">
                  Currently in your bag: {existingBagItem.productName}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button className="h-11" onClick={() => navigate("/bag")}>
              Go to bag
            </Button>
            <Button variant="outline" className="h-11" onClick={replaceBagItem}>
              Replace current item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

const Row = ({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) => (
  <div className="flex items-center justify-between text-sm">
    <span className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
    <span className={muted ? "text-muted-foreground" : "text-foreground"}>
      ฿{value.toLocaleString()}
    </span>
  </div>
);

interface DateFieldProps {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder: string;
  disabled: (d: Date) => boolean;
  fromDate?: Date;
  isDisabledTrigger?: boolean;
}

const DatePickerField = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  fromDate,
  isDisabledTrigger,
}: DateFieldProps) => (
  <div>
    <Label className="text-xs font-medium text-foreground mb-1.5 block">{label}</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={isDisabledTrigger}
          className={cn(
            "h-11 w-full justify-start font-normal bg-background",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          {value ? fmtDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
          fromDate={fromDate}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  </div>
);

export default Booking;
