import { formatDisplayDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import CustomerLayout, { PageHero } from "@/components/customer/CustomerLayout";
import StatusBadge from "@/components/customer/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCustomerBookings, isActive } from "@/hooks/useCustomerBookings";
import { fmtDate, startOfDay } from "@/lib/booking-logic";
import { cn } from "@/lib/utils";
import { formatBookingReference } from "@/lib/booking-reference";
import CustomerOrderDetailDialog from "@/components/customer/CustomerOrderDetailDialog";

type Filter = "all" | "returned" | "cancelled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "returned", label: "Returned" },
  { id: "cancelled", label: "Cancelled" },
];

const History = () => {
  const { data, loading } = useCustomerBookings();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    // History page = finished bookings (completed, cancelled or rejected).
    // Active lifecycle bookings live on /home and /tracking.
    const base = data.filter(
      (b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected",
    );
    return base.filter((b) => {
      if (q) {
        const hay = `${b.id} ${b.product_names.join(" ")} ${b.vendor_name ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (filter === "all") return true;
      if (filter === "returned") return b.status === "completed";
      if (filter === "cancelled") return b.status === "cancelled" || b.status === "rejected";
      return true;
    });
  }, [data, filter, q]);

  return (
    <CustomerLayout hero={<PageHero title="Rent history" subtitle="All your past and current rentals" />}>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order ID or product name…"
            className="pl-9 h-11 bg-card"
          />
        </div>
      </div>

      <div className="inline-flex gap-1 p-1 rounded-full bg-muted mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-4 h-8 rounded-full text-sm font-medium transition-colors",
              filter === f.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No bookings match your filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <article
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailId(b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetailId(b.id);
                }
              }}
              className="bg-card border border-border rounded-2xl p-4 flex gap-4 cursor-pointer hover:border-foreground/30 transition-colors"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-muted overflow-hidden shrink-0">
                {b.product_image && (
                  <img src={b.product_image} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">
                    {b.product_names.join(", ") || "Rental order"}
                  </h3>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Order ID: <span className="font-mono">{formatBookingReference(b.id)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDisplayDate(b.rental_start)} → {formatDisplayDate(b.rental_end)}
                </p>
                <p className="text-xs text-muted-foreground">Vendor: {b.vendor_name ?? "—"}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <p className="font-medium">฿{b.grand_total.toLocaleString()}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailId(b.id);
                  }}
                >
                  View details
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <CustomerOrderDetailDialog
        bookingId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
      />

    </CustomerLayout>
  );
};

export default History;
