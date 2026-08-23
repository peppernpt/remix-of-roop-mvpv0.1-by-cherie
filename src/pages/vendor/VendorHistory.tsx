import { useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import VendorTopBar from "@/components/vendor/VendorTopBar";
import { useVendor } from "@/hooks/useVendor";
import { useVendorBookings } from "@/hooks/useVendorBookings";
import OrderDetailDialog, { type VendorBooking } from "@/components/vendor/OrderDetailDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type BookingStatus,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/lib/booking-status";
import { useNavigate } from "react-router-dom";

const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 })
    .format(n);

const fmtRange = (a: string, b: string) => {
  const o = { day: "2-digit", month: "short" } as const;
  return `${new Date(a).toLocaleDateString("en-GB", o)} – ${new Date(b).toLocaleDateString("en-GB", o)}`;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "rejected", label: "Rejected" },
] as const;

const VendorHistory = () => {
  const navigate = useNavigate();
  const { vendor, loading: vendorLoading } = useVendor();
  const { bookings, loading, replaceBooking } = useVendorBookings(vendor?.id);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VendorBooking | null>(null);

  const history = useMemo(
    () =>
      bookings.filter(
        (b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected",
      ),
    [bookings],
  );

  const filtered = useMemo(() => {
    let list = history;
    if (filter !== "all") list = list.filter((b) => b.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.shortRef.toLowerCase().includes(q) ||
          b.customer.name.toLowerCase().includes(q) ||
          b.items.some((i) => i.productName.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [history, filter, query]);

  if (vendorLoading) {
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
      <VendorTopBar storeName={vendor.store_name} />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage all your rental transactions
          </p>
        </div>

        <Tabs
          value="history"
          onValueChange={(v) => v === "transactions" && navigate("/vendor/transactions")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count =
                f.key === "all"
                  ? history.length
                  : history.filter((b) => b.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors border",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      active ? "bg-background/20" : "bg-muted",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, customer, or product…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground tracking-wide">
                <tr className="border-b border-border">
                  <th className="text-left font-medium py-3 px-3">Customer</th>
                  <th className="text-left font-medium py-3 px-3">Order ID</th>
                  <th className="text-center font-medium py-3 px-3">Items</th>
                  <th className="text-left font-medium py-3 px-3">Dates</th>
                  <th className="text-left font-medium py-3 px-3">Status</th>
                  <th className="text-right font-medium py-3 px-3">Value</th>
                  <th className="text-right font-medium py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      Loading history…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      {query ? "No orders match your search." : "Completed and cancelled orders will appear here."}
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="py-3 px-3">
                      <div className="font-medium">{b.customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: #{b.customer.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">#{b.shortRef}</td>
                    <td className="py-3 px-3 text-center">{b.items.length}</td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {fmtRange(b.rentalStart, b.rentalEnd)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap",
                          STATUS_TONES[b.status as BookingStatus],
                        )}
                      >
                        {STATUS_LABELS[b.status as BookingStatus] ?? b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-primary">
                      {fmtTHB(b.grandTotal || b.rentalTotal + b.depositTotal)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => setSelected(b)}
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
      </main>

      <OrderDetailDialog
        open={!!selected}
        booking={selected}
        onClose={() => setSelected(null)}
        onUpdated={(b) => {
          replaceBooking(b);
          setSelected(b);
        }}
      />
    </div>
  );
};

export default VendorHistory;
