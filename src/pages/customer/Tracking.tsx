import { formatDisplayDate, parseDatabaseDate, formatActualReturnDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ArrowRight } from "lucide-react";
import PaymentCallout from "@/components/customer/PaymentCallout";
import CustomerLayout, { PageHero } from "@/components/customer/CustomerLayout";
import StatusBadge from "@/components/customer/StatusBadge";
import { useCustomerBookings, isActive } from "@/hooks/useCustomerBookings";
import { startOfDay, addDays, fmtDate } from "@/lib/booking-logic";
import { cn } from "@/lib/utils";
import CustomerOrderDetailDialog from "@/components/customer/CustomerOrderDetailDialog";
import {
  RETURN_ADDRESS_MISSING,
  RETURN_ADDRESS_MISSING_HINT,
  RETURN_FEE_SHORT,
} from "@/lib/return-address";


const COLORS = [
  "bg-orange-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-violet-400",
  "bg-rose-400",
];

const Tracking = () => {
  const { data, loading } = useCustomerBookings();
  const active = useMemo(() => data.filter((b) => isActive(b.status)), [data]);
  const [detailId, setDetailId] = useState<string | null>(null);


  const colorFor = (id: string) => {
    const idx = active.findIndex((b) => b.id === id);
    return COLORS[idx % COLORS.length];
  };

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Build calendar grid
  const grid = useMemo(() => {
    const first = new Date(cursor);
    const startWeekDay = first.getDay(); // Sun=0
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0
    ).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startWeekDay; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const bookingsOnDay = (date: Date) => {
    const t = startOfDay(date).getTime();
    return active.filter((b) => {
      const s = parseDatabaseDate(b.rental_start).getTime();
      const e = parseDatabaseDate(b.rental_end).getTime();
      return t >= s && t <= e;
    });
  };

  return (
    <CustomerLayout
      hero={<PageHero title="Tracking calendar" subtitle="Your rental schedule and delivery timeline" />}
    >
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          <section className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">{monthLabel}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  }
                  className="w-8 h-8 grid place-items-center rounded-full border border-border hover:bg-muted"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  }
                  className="w-8 h-8 grid place-items-center rounded-full border border-border hover:bg-muted"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-[11px] text-muted-foreground mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-2 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell, i) => {
                if (!cell.date) return <div key={i} className="aspect-square" />;
                const onDay = bookingsOnDay(cell.date);
                const isToday =
                  startOfDay(cell.date).getTime() === startOfDay(new Date()).getTime();
                return (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-md border border-border p-1.5 text-xs flex flex-col",
                      isToday && "border-foreground"
                    )}
                  >
                    <span className={cn("text-foreground", isToday && "font-semibold")}>
                      {cell.date.getDate()}
                    </span>
                    <div className="mt-auto flex flex-col gap-0.5">
                      {onDay.slice(0, 2).map((b) => (
                        <span
                          key={b.id}
                          className={cn("h-1 rounded-full", colorFor(b.id))}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {active.length > 0 && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Legend
                </p>
                <div className="flex flex-wrap gap-3">
                  {active.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <span className={cn("w-3 h-3 rounded-sm", colorFor(b.id))} />
                      <span className="text-foreground truncate max-w-[160px]">
                        {b.product_names[0] ?? "Order"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            {active.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                No active rentals.
              </div>
            ) : (
              active.map((b) => {
                const isPending = b.status === "pending_vendor_review";
                return (
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
                  className="text-left w-full bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className={cn("w-2 h-10 rounded-full", colorFor(b.id))} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-sm truncate">
                          {b.product_names.join(", ") || "Rental"}
                        </h3>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplayDate(b.rental_start)} → {formatDisplayDate(b.rental_end)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Mini
                      icon={<ArrowDown className="w-3.5 h-3.5 text-emerald-600" />}
                      label="Arrival"
                      value={formatDisplayDate(b.rental_start)}
                    />
                    <Mini
                      icon={<ArrowUp className="w-3.5 h-3.5 text-orange-600" />}
                      label="Return by"
                      value={formatActualReturnDate(b.rental_end)}
                    />

                  </div>
                  {isPending && (
                    <Link
                      to={`/order-sent/${b.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Tap to view LINE message <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                  <PaymentCallout bookingId={b.id} status={b.status} variant="full" />
                  {(b.status === "on_rent" || b.status === "on_return") && (
                    <div
                      className={cn(
                        "mt-3 rounded-lg border p-3 text-xs",
                        b.status === "on_return"
                          ? "border-orange-300 bg-orange-50"
                          : "border-border bg-muted/50",
                      )}
                    >
                      <p className="font-medium text-foreground mb-1.5">Return instructions</p>
                      <p className="text-muted-foreground">
                        Return by:{" "}
                        <span className="text-foreground">{formatActualReturnDate(b.rental_end)}</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Return address:{" "}
                        <span className="text-foreground">
                          {b.vendor_return_address ?? RETURN_ADDRESS_MISSING}
                        </span>
                      </p>
                      {!b.vendor_return_address && (
                        <p className="text-muted-foreground mt-0.5">{RETURN_ADDRESS_MISSING_HINT}</p>
                      )}
                      <p className="text-muted-foreground mt-0.5">
                        Return delivery fee:{" "}
                        <span className="text-foreground">{RETURN_FEE_SHORT}</span>
                      </p>
                      {b.status === "on_return" && (
                        <p className="mt-2 font-medium text-orange-700">
                          Please send the item back to the store by today and share the return
                          tracking details with the store via LINE.
                        </p>
                      )}
                    </div>
                  )}
                  {b.delivery_tracking_url && (
                    <a
                      href={b.delivery_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 ml-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Open tracking link <ArrowRight className="w-3 h-3" />
                    </a>
                  )}

                </article>
                );
              })

            )}
          </aside>
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

const Mini = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg bg-muted/50 p-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
      {icon}
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-foreground font-medium">{value}</p>
  </div>
);

export default Tracking;
