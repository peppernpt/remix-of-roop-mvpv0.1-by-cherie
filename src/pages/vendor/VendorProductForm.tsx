import { buildSku, serialFor, highestUnitNumber, uniqueSku, variationKey } from "@/lib/sku";
import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeCustomRates, getRentalSubtotal } from "@/lib/pricing";

import { useNavigate, useParams } from "react-router-dom";
import { Save, X, Trash2, Upload, Star, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "@/hooks/use-toast";
import VendorTopBar from "@/components/vendor/VendorTopBar";
import { useVendor } from "@/hooks/useVendor";
import BackButton from "@/components/BackButton";
import ProductUnitsDialog from "@/components/vendor/ProductUnitsDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


const CATEGORIES = ["Clothing", "Accessories", "Bags", "Shoes", "Jewelry", "Other"];
const CONDITIONS = ["Excellent", "Good", "Fair"];

interface ImageItem {
  id?: string;
  url: string;
  display_order: number;
  isNew?: boolean;
  file?: File;
}

// Custom duration prices keyed by rental days -> raw input string ("" = use fallback)
type CustomPriceMap = Record<number, string>;

const MAX_GENERATED_ROWS = 60;





const VendorProductForm = ({ mode }: { mode: "create" | "edit" }) => {
  const { vendor, loading: vendorLoading } = useVendor();
  const navigate = useNavigate();
  const { id: productId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Basic info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  // Unit-level default (applied only to newly generated units)
  const [defaultCondition, setDefaultCondition] = useState<string>("Excellent");

  // Pricing & rules
  const [dailyRate, setDailyRate] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [minDays, setMinDays] = useState<string>("1");
  const [maxDays, setMaxDays] = useState<string>("30");

  // Optional custom duration pricing (product_rental_rates)
  const [customPricingEnabled, setCustomPricingEnabled] = useState(false);
  const [customPrices, setCustomPrices] = useState<CustomPriceMap>({});



  // Specs
  const [weight, setWeight] = useState<string>("");
  const [dimensions, setDimensions] = useState<string>("");
  const [specifications, setSpecifications] = useState<string>("");

  // Inventory
  const [quantity, setQuantity] = useState<string>("1");
  const [existingUnitsCount, setExistingUnitsCount] = useState(0);
  // Highest serial suffix ever used (incl. archived units) so new serials never collide.
  const [maxSerialIndex, setMaxSerialIndex] = useState(0);

  const [savedSku, setSavedSku] = useState<string>("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);

  const [unitsOpen, setUnitsOpen] = useState(false);
  // Duplicate-SKU guard (create mode): existing listing with the same generated SKU.
  const [dupProduct, setDupProduct] = useState<{
    id: string;
    name: string;
    brand: string | null;
    size: string | null;
    color: string | null;
    sku: string;
    total: number;
    available: number;
  } | null>(null);
  const [addingUnits, setAddingUnits] = useState(false);
  const [unitCounts, setUnitCounts] = useState({ active: 0, available: 0, archived: 0 });

  const refreshUnitCounts = useCallback(async () => {
    if (!productId) return;
    const { data } = await supabase
      .from("product_units")
      .select("id, status, is_active")
      .eq("product_id", productId);
    const all = (data ?? []) as any[];
    const active = all.filter((u) => u.is_active !== false);
    setUnitCounts({
      active: active.length,
      available: active.filter((u) => u.status === "available").length,
      archived: all.length - active.length,
    });
  }, [productId]);

  useEffect(() => {
    if (mode === "edit") refreshUnitCounts();
  }, [mode, refreshUnitCounts]);

  // SKU = product variation level: BRANDCODE-PRODUCTCODE-COLORCODE-SIZE.
  // Existing products keep their stored SKU so serials stay stable.
  const generatedSku = useMemo(
    () => buildSku({ name, brand, color, size }),
    [name, brand, color, size],
  );
  const previewSku = savedSku || generatedSku;

  // Rental Rules drive the Custom Duration Pricing rows.
  const minD = parseInt(minDays, 10);
  const maxD = parseInt(maxDays, 10);
  const rangeValid =
    Number.isInteger(minD) && minD >= 1 && Number.isInteger(maxD) && maxD >= minD;
  const durationRows = useMemo(() => {
    if (!rangeValid) return [] as number[];
    const end = Math.min(maxD, minD + MAX_GENERATED_ROWS - 1);
    const out: number[] = [];
    for (let d = minD; d <= end; d++) out.push(d);
    return out;
  }, [rangeValid, minD, maxD]);

  // Custom prices actually typed by the vendor (blank fields are never saved).
  const enteredRates = useMemo(
    () =>
      normalizeCustomRates(
        Object.entries(customPrices)
          .filter(([, v]) => String(v ?? "").trim() !== "")
          .map(([d, v]) => ({ rental_days: Number(d), price: Number(v) })),
      ),
    [customPrices],
  );



  useEffect(() => {
    if (mode !== "edit" || !productId || !vendor) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: p, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle();
        if (error) throw error;
        if (!p || p.vendor_id !== vendor.id) {
          toast({ title: "Product not found", variant: "destructive" });
          navigate("/vendor/inventory", { replace: true });
          return;
        }
        if (cancelled) return;
        setName(p.name ?? "");
        setDescription(p.description ?? "");
        setCategory(p.category ?? "");
        setBrand((p as any).brand ?? "");
        setColor(p.color ?? "");
        setSize(p.size ?? "");
        setDailyRate(String(p.daily_rental_rate ?? ""));
        setDepositAmount(
          (p as any).deposit_amount != null ? String((p as any).deposit_amount) : ""
        );
        setMinDays(String((p as any).min_rental_days ?? 1));
        setMaxDays(String((p as any).max_rental_days ?? 30));
        setWeight((p as any).weight_grams != null ? String((p as any).weight_grams) : "");
        setDimensions((p as any).dimensions ?? "");
        setSpecifications((p as any).specifications ?? "");
        setSavedSku((p as any).sku ?? "");

        const { data: rates } = await supabase
          .from("product_rental_rates")
          .select("rental_days, price")
          .eq("product_id", productId)
          .order("rental_days", { ascending: true });
        if (!cancelled) {
          const rows = normalizeCustomRates(rates as any);
          const map: CustomPriceMap = {};
          rows.forEach((r) => {
            map[r.rental_days] = String(r.price);
          });
          setCustomPrices(map);
          setCustomPricingEnabled(rows.length > 0);
        }



        const { data: imgs } = await supabase
          .from("product_images")
          .select("id, image_url, display_order")
          .eq("product_id", productId)
          .order("display_order", { ascending: true });
        if (!cancelled) {
          setImages((imgs ?? []).map((i: any) => ({ id: i.id, url: i.image_url, display_order: i.display_order })));
        }

        const { data: units } = await supabase
          .from("product_units")
          .select("id, condition, serial_id, is_active")
          .eq("product_id", productId);
        if (!cancelled) {
          const all = (units ?? []) as any[];
          const active = all.filter((u) => u.is_active !== false);
          setExistingUnitsCount(active.length);
          setQuantity(String(active.length));
          setMaxSerialIndex(
            all.reduce((max, u) => {
              const m = /-(\d+)$/.exec(String(u.serial_id ?? ""));
              const n = m ? parseInt(m[1], 10) : 0;
              return Number.isFinite(n) && n > max ? n : max;
            }, 0),
          );
          // Existing units keep their own condition; this default only seeds newly added units.
          const c = (active[0] ?? all[0])?.condition;
          if (c) setDefaultCondition(c);
        }

      } catch (e: any) {
        toast({ title: "Failed to load product", description: e?.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, productId, vendor?.id, navigate]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next: ImageItem[] = Array.from(files).slice(0, 10 - images.length).map((file, idx) => ({
      url: URL.createObjectURL(file),
      display_order: images.length + idx,
      isNew: true,
      file,
    }));
    setImages((prev) => [...prev, ...next]);
  };

  const setPrimary = (idx: number) => {
    setImages((prev) => {
      const copy = [...prev];
      const [pick] = copy.splice(idx, 1);
      return [pick, ...copy].map((img, i) => ({ ...img, display_order: i }));
    });
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy.map((x, i) => ({ ...x, display_order: i }));
    });
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const img = prev[idx];
      if (img.id) setRemovedImageIds((r) => [...r, img.id!]);
      return prev.filter((_, i) => i !== idx).map((x, i) => ({ ...x, display_order: i }));
    });
  };

  const uploadNewImage = async (file: File, productId: string): Promise<string> => {
    if (!vendor) throw new Error("No vendor");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${vendor.owner_id}/products/${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("vendor-logos").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("vendor-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  /**
   * Looks up a listing of this vendor with the exact same variation
   * (brand + name + color + size). Different color/size = different listing.
   * Also returns every SKU in use so a new listing can stay unique.
   */
  const findExistingVariation = async () => {
    if (!vendor) return { match: null as any, takenSkus: [] as string[] };
    const { data } = await supabase
      .from("products")
      .select("id, name, brand, size, color, sku")
      .eq("vendor_id", vendor.id);
    const rows = data ?? [];
    const takenSkus = rows.map((p: any) => (p.sku ?? "").trim()).filter(Boolean);
    const key = variationKey({ name, brand, color, size });
    const match = rows.find((p: any) => variationKey(p) === key);
    if (!match) return { match: null as any, takenSkus };
    const { data: units } = await supabase
      .from("product_units")
      .select("id, status, is_active")
      .eq("product_id", match.id);
    const active = (units ?? []).filter((u: any) => u.is_active !== false);
    return {
      takenSkus,
      match: {
        id: match.id,
        name: match.name,
        brand: match.brand,
        size: match.size,
        color: match.color,
        sku: match.sku,
        total: active.length,
        available: active.filter((u: any) => u.status === "available").length,
      },
    };
  };


  /** Adds the requested quantity as new units under the existing listing. */
  const addUnitsToExisting = async () => {
    if (!dupProduct) return;
    const toCreate = Math.max(0, parseInt(quantity || "0", 10));
    if (toCreate < 1) {
      toast({ title: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    setAddingUnits(true);
    try {
      // Continue serial numbering from the highest number ever used (incl. archived).
      const { data: serials, error: sErr } = await supabase
        .from("product_units")
        .select("serial_id")
        .eq("product_id", dupProduct.id);
      if (sErr) throw sErr;
      const start = highestUnitNumber(
        dupProduct.sku,
        (serials ?? []).map((r: any) => r.serial_id ?? ""),
      );
      const rows = Array.from({ length: toCreate }, (_, i) => ({
        product_id: dupProduct.id,
        serial_id: serialFor(dupProduct.sku, start + i + 1),
        status: "available",
        condition: defaultCondition || "excellent",
        is_active: true,
      }));
      const { error } = await supabase.from("product_units").insert(rows);
      if (error) throw error;
      toast({
        title: `${toCreate} unit${toCreate > 1 ? "s" : ""} added`,
        description: `Added to existing SKU ${dupProduct.sku}.`,
      });
      setDupProduct(null);
      navigate("/vendor/inventory");
    } catch (e: any) {
      toast({ title: "Could not add units", description: e?.message, variant: "destructive" });
    } finally {
      setAddingUnits(false);
    }
  };

  const submit = async () => {
    if (!vendor) return;
    if (!name.trim()) { toast({ title: "Product name required", variant: "destructive" }); return; }
    if (!category) { toast({ title: "Category required", variant: "destructive" }); return; }
    const rateLabel = customPricingEnabled ? "Fallback daily rate" : "Daily rate";
    const rate = Number(dailyRate.trim());
    if (dailyRate.trim() === "") { toast({ title: `${rateLabel} required`, variant: "destructive" }); return; }
    if (!Number.isFinite(rate) || rate < 0) { toast({ title: `${rateLabel} must be a non-negative number`, variant: "destructive" }); return; }

    const depositTrimmed = depositAmount.trim();
    if (depositTrimmed === "") { toast({ title: "Deposit amount required", variant: "destructive" }); return; }
    const deposit = Number(depositTrimmed);
    if (!Number.isFinite(deposit) || deposit < 0) { toast({ title: "Deposit amount must be a non-negative number", variant: "destructive" }); return; }
    const submitMinD = parseInt(minDays || "0", 10);
    const submitMaxD = parseInt(maxDays || "0", 10);
    if (!Number.isFinite(submitMinD) || submitMinD < 1) { toast({ title: "Minimum rental days must be at least 1", variant: "destructive" }); return; }
    if (!Number.isFinite(submitMaxD) || submitMaxD < submitMinD) { toast({ title: "Maximum rental days must be ≥ minimum", variant: "destructive" }); return; }
    if (mode === "create" && !defaultCondition) { toast({ title: "Default unit condition required", variant: "destructive" }); return; }

    // Optional custom duration pricing — rows are generated from the rental range.
    // Only rows with a price entered are saved; blank rows fall back to the daily rate.
    const parsedRates: { rental_days: number; price: number }[] = [];
    if (customPricingEnabled) {
      for (let d = submitMinD; d <= submitMaxD; d++) {
        const raw = (customPrices[d] ?? "").trim();
        if (raw === "") continue;
        const pr = Number(raw);
        if (!Number.isFinite(pr) || pr < 0) {
          toast({
            title: "Custom rental price must be a number ≥ 0",
            description: `Check the price for ${d} day${d > 1 ? "s" : ""}.`,
            variant: "destructive",
          });
          return;
        }
        parsedRates.push({ rental_days: d, price: pr });
      }
    }






    setSaving(true);
    try {
      let pid = productId as string | undefined;
      let sku = savedSku;
      if (!sku) {
        // Only the exact same variation (brand + name + color + size) is a
        // duplicate; then ask the vendor to add units instead of a new listing.
        const { match, takenSkus } = await findExistingVariation();
        if (match) {
          setDupProduct(match);
          setSaving(false);
          return;
        }
        // Different variation: guarantee a unique SKU even if codes collide.
        sku = uniqueSku(generatedSku, takenSkus);
      }


      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        brand: brand.trim() || null,
        color: color.trim() || null,
        size: size.trim() || null,
        daily_rental_rate: rate,
        deposit_amount: deposit,
        min_rental_days: submitMinD,
        max_rental_days: submitMaxD,
        weight_grams: weight ? parseInt(weight, 10) : null,
        dimensions: dimensions.trim() || null,
        specifications: specifications.trim() || null,
        sku,
        publish_status: "published",
        is_active: true,
      };

      if (mode === "create") {
        const { data, error } = await supabase
          .from("products")
          .insert({ vendor_id: vendor.id, ...payload })
          .select("id")
          .single();
        if (error) throw error;
        pid = data.id;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", pid!);
        if (error) throw error;
      }
      // Custom duration pricing: replace the full set for this product.
      // (Rental subtotal only — deposit and delivery fee live elsewhere.)
      {
        const keep = customPricingEnabled ? parsedRates : [];
        const existing = await supabase
          .from("product_rental_rates")
          .select("id, rental_days")
          .eq("product_id", pid!);
        const existingRows = (existing.data ?? []) as any[];
        const keepDays = new Set(keep.map((r) => r.rental_days));
        const toDelete = existingRows.filter((r) => !keepDays.has(Number(r.rental_days)));
        if (toDelete.length) {
          const { error: dErr } = await supabase
            .from("product_rental_rates")
            .delete()
            .in("id", toDelete.map((r) => r.id));
          if (dErr) throw dErr;
        }
        if (keep.length) {
          const { error: uErr } = await supabase
            .from("product_rental_rates")
            .upsert(
              keep.map((r) => ({ product_id: pid!, rental_days: r.rental_days, price: r.price })),
              { onConflict: "product_id,rental_days" },
            );
          if (uErr) throw uErr;
        }
      }


      // Remove deleted images
      if (removedImageIds.length) {
        await supabase.from("product_images").delete().in("id", removedImageIds);
      }

      // Upload new images & update display order
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.isNew && img.file) {
          const url = await uploadNewImage(img.file, pid!);
          await supabase.from("product_images").insert({
            product_id: pid!,
            image_url: url,
            display_order: i,
          });
        } else if (img.id) {
          await supabase.from("product_images").update({ display_order: i }).eq("id", img.id);
        }
      }

      // Units are only generated when creating the listing. Afterwards, all unit
      // changes (add / edit / archive / restore) happen inside "View units".
      if (mode === "create") {
        const toCreate = Math.max(0, parseInt(quantity || "0", 10));
        if (toCreate > 0) {
          const newUnits = Array.from({ length: toCreate }, (_, i) => ({
            product_id: pid!,
            serial_id: serialFor(sku, i + 1),
            status: "available",
            condition: defaultCondition,
          }));
          const { error: uErr } = await supabase.from("product_units").insert(newUnits);
          if (uErr) throw uErr;
        }
      }



      toast({ title: mode === "create" ? "Product created" : "Product updated" });
      navigate("/vendor/inventory");
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) return;
    if (!confirm("Delete this product? Units linked to active bookings will block deletion.")) return;
    setDeleting(true);
    try {
      const { data: units } = await supabase
        .from("product_units")
        .select("id")
        .eq("product_id", productId);
      const unitIds = (units ?? []).map((u: any) => u.id);
      if (unitIds.length) {
        const { count } = await supabase
          .from("booking_items")
          .select("*", { count: "exact", head: true })
          .in("product_unit_id", unitIds);
        if ((count ?? 0) > 0) {
          toast({
            title: "Cannot delete",
            description: "Some units are tied to bookings. Archive the product instead.",
            variant: "destructive",
          });
          setDeleting(false);
          return;
        }
      }

      await supabase.from("product_images").delete().eq("product_id", productId);
      await supabase.from("product_units").delete().eq("product_id", productId);
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
      toast({ title: "Product deleted" });
      navigate("/vendor/inventory");
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (vendorLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        No vendor profile found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <VendorTopBar storeName={vendor.store_name} showBack={false} />
      <div className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallback="/vendor/inventory" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {mode === "create" ? "Add New Product" : "Edit Product"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {mode === "create" ? "Create a new rental product listing" : "Update product information and settings"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" && (
              <Button variant="outline" onClick={handleDelete} disabled={deleting} className="text-destructive border-destructive/40 hover:bg-destructive/5">
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/vendor/inventory")}>
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              <Save className="w-4 h-4" /> {mode === "create" ? "Save Product" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Basic Information">
            <div className="space-y-4">
              <Field label="Product Name *">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter product name" />
              </Field>
              <Field label="Description">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your product in detail…"
                  rows={4}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Category *">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Brand">
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Gucci" />
                </Field>
                <Field label="Color">
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black" />
                </Field>
                <Field label="Size Label">
                  <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. M / 60×40×5 cm" />
                  <p className="text-xs text-red-500 font-bold mt-1.5">
                    For MVP, create a separate product listing for each size or color variation.
                  </p>
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Product Images" subtitle="Upload up to 10 images. First image is the primary. Drag-free reorder with the arrows.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div key={img.id ?? img.url} className="relative aspect-square rounded-xl border border-border overflow-hidden group bg-muted">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-medium">
                      Primary
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    {idx !== 0 && (
                      <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setPrimary(idx)} title="Set as primary">
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => moveImage(idx, -1)} disabled={idx === 0} title="Move up">
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} title="Move down">
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeImage(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {images.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors text-muted-foreground">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                  />
                </label>
              )}
            </div>
          </Section>

          <Section title="Rental Rules">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Minimum Rental Days *">
                <Input type="number" min={1} step="1" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
              </Field>
              <Field label="Maximum Rental Days *">
                <Input type="number" min={1} step="1" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Customers can only book within this range. Maximum must be ≥ minimum.
            </p>
          </Section>

          <Section title="Pricing" subtitle="Choose how ROOP should calculate the rental price for this listing.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {
                  value: false,
                  title: "Auto Daily Pricing",
                  desc: "Daily rate × rental days",
                },
                {
                  value: true,
                  title: "Custom Duration Pricing",
                  desc: "Set exact rental prices for specific durations",
                },
              ] as const).map((opt) => {
                const selected = customPricingEnabled === opt.value;
                return (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={() => setCustomPricingEnabled(opt.value)}

                    aria-pressed={selected}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${
                          selected ? "border-primary" : "border-muted-foreground/40"
                        }`}
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <Field label={customPricingEnabled ? "Fallback Daily Rate (฿) *" : "Daily Rate (฿) *"}>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Deposit Amount (฿) *">
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </Field>
            </div>

            {!customPricingEnabled ? (
              <p className="text-xs text-muted-foreground mt-2">
                ROOP will calculate rental price by multiplying the daily rate by the number of rental
                days. Example: 3 days × ฿300 = ฿900.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-medium text-foreground">Custom duration prices</p>
                {!rangeValid ? (
                  <p className="text-xs text-muted-foreground">
                    Set your rental day range first. Enter a valid Minimum and Maximum Rental Days in
                    Rental Rules and the pricing rows will be generated automatically.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_1fr] gap-3 text-xs font-medium text-muted-foreground">
                      <span>Rental Duration</span>
                      <span>Custom Price (฿ total)</span>
                    </div>
                    {durationRows.map((d) => (
                      <div key={d} className="grid grid-cols-[1fr_1fr] gap-3 items-center">
                        <span className="text-sm text-foreground">
                          {d} {d === 1 ? "day" : "days"}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={customPrices[d] ?? ""}
                          placeholder={`Fallback${
                            Number(dailyRate) > 0 || enteredRates.length
                              ? ` ฿${getRentalSubtotal(
                                  { dailyRate: Number(dailyRate) || 0, customRates: enteredRates.filter((r) => r.rental_days !== d) },
                                  d,
                                ).toLocaleString()}`
                              : ""
                          }`}
                          onChange={(e) =>
                            setCustomPrices((prev) => ({ ...prev, [d]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                    {maxD > minD + MAX_GENERATED_ROWS - 1 && (
                      <p className="text-xs text-muted-foreground">
                        Showing the first {MAX_GENERATED_ROWS} durations. Longer rentals use the fallback
                        daily rate.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Each custom price is the <span className="font-medium">total rental price</span> for
                      that duration (e.g. 3 days = ฿600 total, not per day). If a custom price is left
                      empty, ROOP will calculate that duration using the fallback daily rate.
                    </p>
                  </>
                )}
              </div>
            )}


            <p className="text-xs text-muted-foreground mt-3">
              This refundable deposit will be added to the customer's payment total and returned after the
              item is safely returned.
            </p>
          </Section>



          <Section title="Specifications" subtitle="Optional details to help customers pick the right item.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Weight (grams)">
                <Input type="number" min={0} step="1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 500" />
              </Field>
              <Field label="Dimensions">
                <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="e.g. 30 × 20 × 10 cm" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Additional Specifications">
                <Textarea
                  value={specifications}
                  onChange={(e) => setSpecifications(e.target.value)}
                  placeholder="Material, care instructions, accessories included…"
                  rows={3}
                />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {mode === "create" ? (
            <Section title="Inventory Setup">
              <div className="space-y-4">
                <Field label="Quantity of Physical Units *">
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </Field>
                <Field label="Default Unit Condition *">
                  <Select value={defaultCondition} onValueChange={setDefaultCondition}>
                    <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-xs text-muted-foreground">
                  Quantity should only include physical copies of the same item, size, and color. The
                  default condition will be applied to each generated unit and can be edited later in
                  View Units.
                </p>
                <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 text-xs text-muted-foreground">
                  <div>SKU: <span className="font-mono text-foreground">{previewSku}</span></div>
                  <div className="mt-1">
                    Serial IDs will be automatically generated for each physical unit (e.g. <span className="font-mono">{previewSku}-001</span>, <span className="font-mono">{previewSku}-002</span>).
                  </div>
                  {!!savedSku && (
                    <div className="mt-1">
                      SKU/Serial IDs are kept stable for products that already have inventory.
                    </div>
                  )}
                </div>
              </div>
            </Section>
          ) : (
            <Section title="Physical Units">
              <div className="space-y-3">
                <SummaryRow label="Total active" value={unitCounts.active} />
                <SummaryRow label="Available" value={unitCounts.available} />
                <SummaryRow label="Archived" value={unitCounts.archived} />
                <p className="text-xs text-muted-foreground">
                  Unit condition, notes, archiving and new units are managed in View Units.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setUnitsOpen(true)}>
                  Manage units
                </Button>
              </div>
            </Section>
          )}
        </div>
      </main>

      <Dialog open={!!dupProduct} onOpenChange={(o) => !o && setDupProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>This SKU already exists</DialogTitle>
            <DialogDescription>
              A product listing with this SKU already exists:{" "}
              <span className="font-mono">{dupProduct?.sku}</span>. Do you want to add these units
              to the existing product listing instead?
            </DialogDescription>
          </DialogHeader>
          {dupProduct && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5 text-sm">
              <InfoRow label="Product name" value={dupProduct.name} />
              <InfoRow label="Brand" value={dupProduct.brand || "—"} />
              <InfoRow label="Size" value={dupProduct.size || "—"} />
              <InfoRow label="Color" value={dupProduct.color || "—"} />
              <InfoRow label="SKU" value={dupProduct.sku} mono />
              <InfoRow label="Current total units" value={String(dupProduct.total)} />
              <InfoRow label="Current available units" value={String(dupProduct.available)} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDupProduct(null)} disabled={addingUnits}>
              Cancel
            </Button>
            <Button onClick={addUnitsToExisting} disabled={addingUnits}>
              {addingUnits ? "Adding…" : "Add units to existing SKU"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {mode === "edit" && productId && (
        <ProductUnitsDialog
          productId={productId}
          productName={name}
          sku={previewSku}
          open={unitsOpen}
          onClose={() => setUnitsOpen(false)}
          onChanged={refreshUnitCounts}
        />
      )}
    </div>
  );
};

const InfoRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className={`text-right ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</span>
  </div>
);

const SummaryRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);



const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm">
    <h2 className="text-base font-semibold">{title}</h2>
    {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

export default VendorProductForm;
