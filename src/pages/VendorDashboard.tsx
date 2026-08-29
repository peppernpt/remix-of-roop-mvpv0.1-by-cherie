import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DollarSign,
  Package,
  ShoppingCart,
  LogOut,
  Bell,
  Settings,
  LayoutGrid,
  Boxes,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import BackButton from "@/components/BackButton";
import OrderDetailDialog, { type VendorBooking } from "@/components/vendor/OrderDetailDialog";
import { useVendorBookings } from "@/hooks/useVendorBookings";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking-status";

interface VendorRow {
  id: string;
  store_name: string;
}

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 })
    .format(n);

const VendorDashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [loadingVendor, setLoadingVendor] = useState(true);
  const [selected, setSelected] = useState<VendorBooking | null>(null);

  const { bookings, loading: bookingsLoading, replaceBooking } = useVendorBookings(vendor?.id);
  const loadingData = loadingVendor || bookingsLoading;

  // Auth gate
  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/vendor/dashboard", { replace: true });
  }, [user, loading, navigate]);

  // Load vendor + product count (bookings come from shared hook)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingVendor(true);
      try {
        const { data: vendorRow, error: vErr } = await supabase
          .from("vendors")
          .select("id, store_name")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (vErr) throw vErr;
        if (cancelled) return;
        setVendor(vendorRow ?? null);
        if (!vendorRow) return;

        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", vendorRow.id);
        if (!cancelled) setProductCount(count ?? 0);
      } catch (e: any) {
        toast({ title: "Failed to load dashboard", description: e?.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoadingVendor(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = useMemo(() => {
    // Revenue counts only completed bookings (money truly earned).
    // Rental earnings only: honour any vendor discount, and keep the delivery
    // fee out — it is a pass-through cost, not rental revenue.
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const totalRevenue = completedBookings.reduce(
      (sum, b) => sum + (b.discountedRentalTotal ?? b.rentalTotal),
      0,
    );
    // Active rentals = strictly bookings.status in fulfilment lifecycle
    const ACTIVE_STATUSES = ["to_deliver", "on_delivery", "on_rent", "on_return"];
    const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length;
    // Pending Request = new requests awaiting vendor review
    const pending = bookings.filter((b) => b.status === "pending_vendor_review").length;
    return { totalRevenue, active, pending };
  }, [bookings]);

  if (loading || (user && loadingData)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    );
  }

  if (user && !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-semibold">No vendor store found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            You're signed in but don't have a vendor profile yet.
          </p>
          <Button asChild className="mt-4">
            <Link to="/vendor/setup">Set up your store</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto h-16 px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BackButton fallback="/" />
            <Link to="/" className="text-xl font-bold tracking-tight uppercase">ROOP</Link>
            <nav className="hidden md:flex items-center gap-1 ml-2">
              <NavTab icon={LayoutGrid} label="Dashboard" to="/vendor/dashboard" active />
              <NavTab icon={Receipt} label="Transactions" to="/vendor/transactions" />
              <NavTab icon={Boxes} label="Inventory" to="/vendor/inventory" />

            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Bell className="w-4 h-4" />
            </button>
            <Link
              to="/vendor/settings"
              aria-label="Edit store profile"
              className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <div className="hidden md:block text-right pl-3 border-l border-border">
              <div className="text-sm font-medium leading-tight">{vendor?.store_name}</div>
              <div className="text-xs text-muted-foreground">Vendor Account</div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your store.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue on ROOP"
            value={fmtTHB(stats.totalRevenue)}
            icon={DollarSign}
            tone="emerald"
          />
          <StatCard
            label="Pending Requests"
            value={String(stats.pending)}
            icon={Receipt}
            tone="violet"
          />
          <StatCard
            label="Active Rentals"
            value={String(stats.active)}
            icon={ShoppingCart}
            tone="blue"
          />
          <StatCard
            label="Total Products"
            value={String(productCount)}
            icon={Package}
            tone="violet"
          />
        </div>

        {/* Recent transactions */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between mb-1">
            <div>
              <h2 className="text-lg font-semibold">Recent Transactions</h2>
              <p className="text-sm text-muted-foreground">Your latest rental orders</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(() => {
              const ACTIONABLE_STATUSES: BookingStatus[] = [
                "pending_vendor_review",
                "approved_waiting_payment",
                "payment_submitted",
              ];
              const actionable = bookings.filter((b) =>
                ACTIONABLE_STATUSES.includes(b.status as BookingStatus),
              );
              if (actionable.length === 0) {
                return (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl">
                    <div className="text-sm font-medium">No pending requests</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      All active rentals are being managed in Transactions.
                    </div>
                  </div>
                );
              }
              return actionable.slice(0, 8).map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground tracking-wide">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                      {initials(b.customer.name)}
                    </span>
                    Customer
                  </div>
                  <div className="font-medium mt-1">{b.customer.name}</div>
                  <div className="text-xs text-muted-foreground">ID: #{b.customer.id.slice(0, 8)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wide">Order Info</div>
                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">Order ID</span>{" "}
                    <span className="font-medium">#{b.shortRef}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Items</span>{" "}
                    <span className="font-medium">{b.items.length}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wide">Total Value</div>
                  <div className="mt-1 text-xl font-semibold text-primary">{fmtTHB(b.grandTotal)}</div>
                  <div className="text-xs text-muted-foreground">{STATUS_LABELS[b.status as BookingStatus] ?? b.status.replace(/_/g, " ")}</div>
                </div>
              </button>
              ));
            })()}
          </div>
        </section>
      </main>

      <OrderDetailDialog
        booking={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          replaceBooking(updated);
          setSelected(updated);
        }}
      />
    </div>
  );
};

const NavTab = ({
  icon: Icon,
  label,
  active,
  to,
}: {
  icon: any;
  label: string;
  active?: boolean;
  to: string;
}) => (
  <Link
    to={to}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </Link>
);

const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: any;
  tone: "emerald" | "blue" | "violet";
}) => {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1.5 tracking-tight">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export default VendorDashboard;
