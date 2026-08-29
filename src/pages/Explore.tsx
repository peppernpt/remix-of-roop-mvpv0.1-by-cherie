import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, ChevronLeft, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CustomerNav from "@/components/customer/CustomerNav";
import FloatingBagButton from "@/components/customer/FloatingBagButton";
import { getStartingPrice, normalizeCustomRates } from "@/lib/pricing";

const SIZES = ["All", "XS", "S", "M", "L", "XL"];
const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
];

interface Product {
  id: string;
  name: string;
  storeName: string;
  storeLocation: string | null;
  dailyRate: number;
  startingPrice: number | null;
  size: string | null;
  color: string | null;
  category: string | null;
  imageUrl: string;
  available: boolean;
  availableCount: number;
  createdAt: string;
}

// Unit statuses that take a physical item out of service for good (not
// date-based). Rental-lifecycle statuses (reserved / on_rent / ...) must NOT
// be listed here — those only block specific dates.
const PERMANENTLY_UNAVAILABLE_UNIT_STATUSES = new Set<string>([
  "retired",
  "damaged",
  "lost",
]);

const FALLBACK_IMG =

  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=800&fit=crop";

const PAGE_SIZE = 24;

const Explore = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [size, setSize] = useState("All");
  const [sort, setSort] = useState("featured");
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("products")
          .select(
            `id, name, category, size, color, daily_rental_rate, created_at, is_active, vendor_id,
             product_images ( image_url, display_order ),
             product_rental_rates ( rental_days, price )`
          )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        // A failed query must read as a failure, never as an empty catalogue.
        setLoadError(error.message);
        setProducts([]);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const productIds = rows.map((p: any) => p.id);
      const vendorIds = Array.from(
        new Set(rows.map((p: any) => p.vendor_id).filter(Boolean)),
      );

      // Store display info and unit availability come from the safe public
      // views (no bank details, contact info, or unit serial numbers exposed).
      const [{ data: vendorRows }, { data: unitRows }] = await Promise.all([
        vendorIds.length
          ? supabase
              .from("vendors_public")
              .select("id, store_name, subdistrict, city, state, is_active")
              .in("id", vendorIds)
          : Promise.resolve({ data: [] as any[] } as any),
        productIds.length
          ? supabase
              .from("product_units_public")
              .select("product_id, status")
              .in("product_id", productIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const vendorMap = new Map((vendorRows ?? []).map((v: any) => [v.id, v]));
      const unitsByProduct = new Map<string, any[]>();
      (unitRows ?? []).forEach((u: any) => {
        const list = unitsByProduct.get(u.product_id) ?? [];
        list.push(u);
        unitsByProduct.set(u.product_id, list);
      });

      const mapped: Product[] = rows
        .filter((p: any) => !!vendorMap.get(p.vendor_id))
        .map((p: any) => {
          const vendor: any = vendorMap.get(p.vendor_id);
          const imgs = (p.product_images ?? []).slice().sort(
            (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
          );
          // Browsability is NOT date-based: a product stays browsable as long
          // as it has at least one usable physical unit. Accepted bookings only
          // block specific dates, which the booking calendar handles via
          // src/lib/availability.ts.
          const availableCount = (unitsByProduct.get(p.id) ?? []).filter(
            (u: any) => !PERMANENTLY_UNAVAILABLE_UNIT_STATUSES.has(u.status)
          ).length;

          const subdistrict: string | null = vendor?.subdistrict?.trim() || null;
          const city: string | null = vendor?.city?.trim() || null;
          const state: string | null = vendor?.state?.trim() || null;
          const location = subdistrict ?? city ?? state ?? null;

          return {
            id: p.id,
            name: p.name,
            storeName: vendor?.store_name ?? "Unknown Store",
            storeLocation: location,
            dailyRate: Number(p.daily_rental_rate ?? 0),
            startingPrice: getStartingPrice({
              dailyRate: Number(p.daily_rental_rate ?? 0),
              customRates: normalizeCustomRates(p.product_rental_rates),
            }),
            size: p.size,
            color: p.color?.trim() || null,
            category: p.category,
            imageUrl: imgs[0]?.image_url ?? FALLBACK_IMG,
            available: availableCount > 0,
            availableCount,
            createdAt: p.created_at,
          };
        });

      setProducts(mapped);
      setLoading(false);
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, category, size, sort]);

  const filtered = useMemo(() => {
    let items = products;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.storeName.toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
      );
    }
    if (category !== "All") items = items.filter((p) => p.category === category);
    if (size !== "All") items = items.filter((p) => p.size === size);

    const priceOf = (p: Product) => p.startingPrice ?? p.dailyRate;
    if (sort === "price-low") items = [...items].sort((a, b) => priceOf(a) - priceOf(b));
    else if (sort === "price-high") items = [...items].sort((a, b) => priceOf(b) - priceOf(a));
    else if (sort === "newest")
      items = [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    else {
      // featured: available first, then newest
      items = [...items].sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return items;
  }, [products, search, category, size, sort]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {user ? (
        <CustomerNav />
      ) : (
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="container-main flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Back</span>
              </Link>
              <span className="text-xl font-bold tracking-tight text-foreground uppercase">
                ROOP
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link to="/auth" className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-lg hover:-translate-y-0.5 transition-all duration-200">
                Get Started
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Search & Filters */}
      <div className="border-b border-border bg-background">
        <div className="container-main py-5">
          {/* Search bar */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search dresses, suits, stores…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          {/* Filter tags */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground gap-1.5 md:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </Button>

            <div className={`flex items-center gap-2 flex-wrap ${showFilters ? "" : "hidden md:flex"}`}>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  className={`cursor-pointer transition-all text-xs px-3 py-1.5 rounded-full ${
                    category === cat
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "hover:bg-muted text-muted-foreground border-border"
                  }`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}

              <Select value={size} onValueChange={setSize}>
                <SelectTrigger className="w-[80px] h-8 text-xs border-border">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => (
                    <SelectItem key={s} value={s}>{s === "All" ? "All Sizes" : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Results bar + Sort */}
      <div className="container-main pt-6 pb-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`}
        </p>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px] h-9 text-sm border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Grid */}
      <main className="container-main pb-20 pt-2">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col">
                <div className="aspect-[3/4] rounded-xl bg-muted animate-pulse mb-3" />
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Couldn't load the catalogue</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Check your connection and try again.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No items found</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.slice(0, visibleCount).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <div className="text-center mt-8">
                <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Show more ({filtered.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
  </main>
  {user && <FloatingBagButton />}
</div>
  );
};

const ProductCard = ({ product }: { product: Product }) => (
  <div className="group flex flex-col">
    <div className={`relative aspect-[3/4] rounded-xl overflow-hidden bg-muted mb-3 ${!product.available ? "opacity-60" : ""}`}>
      <img
        src={product.imageUrl}
        alt={product.name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {(product.size || product.color) && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 max-w-[calc(100%-1.5rem)]">
          {product.size && (
            <span className="inline-flex items-center h-7 px-2.5 bg-background/95 text-foreground text-[11px] font-semibold rounded-full shadow-md ring-1 ring-black/5 backdrop-blur-sm leading-none select-none whitespace-nowrap shrink-0">
              {product.size}
            </span>
          )}
          {product.color && (
            <span className="inline-flex items-center h-7 px-2.5 bg-background/95 text-foreground text-[11px] font-semibold rounded-full shadow-md ring-1 ring-black/5 backdrop-blur-sm leading-none select-none truncate max-w-[140px]">
              {product.color}
            </span>
          )}
        </div>
      )}
      {!product.available && (
        <Badge className="absolute top-3 right-3 bg-foreground/90 text-background text-[10px] font-medium backdrop-blur-sm border-0">
          Unavailable
        </Badge>
      )}
    </div>
    <h3 className="text-sm font-medium text-foreground leading-tight line-clamp-1">
      {product.name}
    </h3>
    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
      {product.storeName}
      {product.storeLocation && (
        <span> · <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3 inline -mt-0.5" />{product.storeLocation}</span></span>
      )}
    </p>
    <div className="flex items-center justify-between mt-2">
      <p className="text-sm font-semibold text-foreground">
        {product.startingPrice != null ? (
          <>
            <span className="text-xs font-normal text-muted-foreground">Starting from </span>
            ฿{product.startingPrice.toLocaleString()}
          </>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">Price unavailable</span>
        )}
      </p>
    </div>
    <Button
      asChild={product.available}
      variant="outline"
      size="sm"
      disabled={!product.available}
      className="mt-2.5 w-full text-xs h-8 rounded-lg border-border hover:bg-foreground hover:text-background transition-all"
    >
      {product.available ? <Link to={`/booking/${product.id}`}>View Details</Link> : <span>View Details</span>}
    </Button>
    <p className="text-[10px] text-muted-foreground mt-1 font-mono">Available units: {product.availableCount}</p>
  </div>
);

export default Explore;
