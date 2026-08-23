import { formatDisplayDate } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Calendar, History, ArrowRight } from "lucide-react";
import PaymentCallout from "@/components/customer/PaymentCallout";
import CustomerLayout, { PageHero } from "@/components/customer/CustomerLayout";
import StatusBadge from "@/components/customer/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerBookings, isActive } from "@/hooks/useCustomerBookings";
import { fmtDate } from "@/lib/booking-logic";

const CustomerHome = () => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const { data, loading } = useCustomerBookings();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.full_name ?? ""));
  }, [user]);

  const active = data.filter((b) => isActive(b.status));
  const greeting = name ? `Welcome back, ${name.split(" ")[0]}` : "Welcome back";

  return (
    <CustomerLayout hero={<PageHero title={greeting} subtitle="Pick up where you left off" />}>
      {/* Quick actions */}
      <section className="grid sm:grid-cols-3 gap-3 mb-8">
        <ActionCard to="/explore" icon={<ShoppingBag className="w-5 h-5" />} title="Rent" desc="Browse the catalogue" />
        <ActionCard to="/tracking" icon={<Calendar className="w-5 h-5" />} title="Tracking" desc="Active rentals" />
        <ActionCard to="/history" icon={<History className="w-5 h-5" />} title="History" desc="Past orders" />
      </section>

      {/* Active rentals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Active rentals</h2>
          {active.length > 0 && (
            <Link
              to="/tracking"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : active.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              You have no active rentals yet. Find something you'll love.
            </p>
            <Button asChild>
              <Link to="/explore">Browse pieces</Link>
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {active.map((b) => {
              const needsPayment =
                b.status === "approved_waiting_payment" ||
                b.status === "payment_submitted";
              const isPending = b.status === "pending_vendor_review";
              return (
                <article
                  key={b.id}
                  className="bg-card border border-border rounded-2xl p-4 flex gap-4"
                >
                  <div className="w-20 h-24 rounded-lg bg-muted overflow-hidden shrink-0">
                    {b.product_image && (
                      <img src={b.product_image} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {b.vendor_name ?? "Vendor"}
                      </p>
                      <StatusBadge status={b.status} />
                    </div>
                    <h3 className="font-medium text-sm truncate">
                      {b.product_names.join(", ") || "Rental order"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDisplayDate(b.rental_start)} → {formatDisplayDate(b.rental_end)}
                    </p>
                    {needsPayment ? (
                      <PaymentCallout
                        bookingId={b.id}
                        status={b.status}
                        variant="compact"
                      />
                    ) : isPending ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Waiting for store approval.
                      </p>
                    ) : (
                      <Link
                        to="/tracking"
                        className="text-xs font-medium text-foreground inline-flex items-center gap-1 mt-2 hover:underline"
                      >
                        Track order <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </CustomerLayout>
  );
};

const ActionCard = ({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <Link
    to={to}
    className="group bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-foreground transition-colors"
  >
    <div className="w-10 h-10 rounded-full bg-muted grid place-items-center text-foreground">
      {icon}
    </div>
    <div className="flex-1">
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
  </Link>
);

export default CustomerHome;
