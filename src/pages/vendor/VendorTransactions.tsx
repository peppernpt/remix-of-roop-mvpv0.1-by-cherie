import { parseDatabaseDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { Search, Eye, Filter } from "lucide-react";
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

type TabKey =
  | "all"
  | "pending_request"
  | "waiting_payment"
  | "payment_submitted"
  | "to_deliver"
  | "on_delivery"
  | "on_rent"
  | "on_return"
  | "for_review";

const TAB_STATUSES: Record<Exclude<TabKey, "all">, BookingStatus[]> = {
  pending_request: ["pending_vendor_review"],
  waiting_payment: ["approved_waiting_payment"],
  payment_submitted: ["payment_submitted"],
  to_deliver: ["paid", "to_deliver"],
  on_delivery: ["on_delivery"],
  on_rent: ["on_rent"],
  on_return: ["on_return"],
  for_review: ["for_review"],
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "View All" },
  { key: "pending_request", label: "Pending Request" },
  { key: "waiting_payment", label: "Waiting Payment" },
  { key: "payment_submitted", label: "Payment Submitted" },
  { key: "to_deliver", label: "To Deliver" },
  { key: "on_delivery", label: "On Delivery" },
  { key: "on_rent", label: "On Rent" },
  { key: "on_return", label: "On Return" },
  { key: "for_review", label: "For Review" },
];


const fmtTHB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 })
    .format(n);

const fmtRange = (a: string, b: string) => {
  const o = { day: "2-digit", month: "short" } as const;
  return `${parseDatabaseDate(a).toLocaleDateString("en-GB", o)} – ${parseDatabaseDate(b).toLocaleDateString("en-GB", o)}`;
};

const VendorTransactions = () => {
  const navigate = useNavigate();
  const { vendor, loading: vendorLoading } = useVendor();
  const { bookings, loading, replaceBooking } = useVendorBookings(vendor?.id);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VendorBooking | null>(null);

  // View All = active transactions only. Completed/cancelled/rejected live in History.
  const CLOSED_STATUSES: BookingStatus[] = ["completed", "cancelled", "rejected"];
  const active = useMemo(
    () => bookings.filter((b) => !CLOSED_STATUSES.includes(b.status as BookingStatus)),
    [bookings],
  );

  // For Review is an active vendor task (inspect + republish). Only the for_review
  // booking status belongs here; completed bookings move to History.
  const isForReview = (b: VendorBooking) => b.status === "for_review";

  const matchesTab = (b: VendorBooking, key: Exclude<TabKey, "all">) => {
    if (key === "for_review") return isForReview(b);
    return TAB_STATUSES[key].includes(b.status as BookingStatus);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: active.length };
    (Object.keys(TAB_STATUSES) as Array<Exclude<TabKey, "all">>).forEach((k) => {
      c[k] = active.filter((b) => matchesTab(b, k)).length;
    });
    return c;
  }, [active]);

  const filtered = useMemo(() => {
    let list = active;
    if (tab !== "all") {
      list = list.filter((b) => matchesTab(b, tab));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.shortRef.toLowerCase().includes(q) ||
          b.customer.name.toLowerCase().includes(q) ||
          b.customer.email.toLowerCase().includes(q) ||
          b.items.some((i) => i.productName.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [active, tab, query]);

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
          value="transactions"
          onValueChange={(v) => v === "history" && navigate("/vendor/history")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {TABS.map((t) => (
              <PillTab
                key={t.key}
                tab={t}
                active={tab === t.key}
                count={counts[t.key]}
                onClick={() => setTab(t.key)}
              />
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, customer, or product…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" disabled className="shrink-0">
              <Filter className="w-4 h-4" /> Filter
            </Button>
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
                      Loading orders…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      {query
                        ? "No orders match your search."
                        : "Orders will appear here as customers book your products."}
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

const PillTab = ({
  tab,
  active,
  count,
  onClick,
}: {
  tab: { key: string; label: string };
  active: boolean;
  count?: number;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors border",
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-background text-muted-foreground border-border hover:text-foreground",
    )}
  >
    {tab.label}
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full",
        active ? "bg-background/20" : "bg-muted",
      )}
    >
      {count ?? 0}
    </span>
  </button>
);

export default VendorTransactions;
