import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CalendarDays, ShieldCheck, ClipboardList, Users, BarChart3, CreditCard, Settings } from "lucide-react";

type Role = "customer" | "vendor";

const features = {
  customer: [
    {
      icon: Sparkles,
      title: "Curated Variety",
      description: "Access a wide selection of styles from verified rental stores, all in one place.",
    },
    {
      icon: CalendarDays,
      title: "Convenient Booking",
      description: "Browse, select, find availability according to your needs.",
    },
    {
      icon: ShieldCheck,
      title: "Trust & Hygiene",
      description: "Items are cleaned and maintained between rentals by our partnered stores",
    },
    {
      icon: ClipboardList,
      title: "Tracking & Records",
      description: "Keep your bookings, payment details, and rental history organized in one place.",
    },
  ],
  vendor: [
    {
      icon: Users,
      title: "Reach More Customers",
      description: "Get discovered by customers actively looking to rent fashion in your area.",
    },
    {
      icon: BarChart3,
      title: "Inventory Management",
      description: "Track every unit with serial-level precision. Know what's out, what's available.",
    },
    {
      icon: CreditCard,
      title: "Manual Payment Control",
      description: "Confirm payments on your terms. Full control over deposits and delivery fees.",
    },
    {
      icon: Settings,
      title: "Simple Onboarding",
      description: "Set up your store in minutes. Add products, set rates, and start receiving requests.",
    },
  ],
};

const FeaturesSection = ({ role }: { role: Role }) => {
  return (
    <section className="section-padding bg-muted/50">
      <div className="container-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1], delay: 0.05 }}
          >
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              {role === "customer" ? "Why rent with ROOP" : "Why list on ROOP"}
            </p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-16" style={{ letterSpacing: "-0.01em" }}>
              {role === "customer"
                ? "Everything you need to rent with confidence."
                : "Everything you need to run your rental business."}
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {features[role].map((f) => (
                <div
                  key={f.title}
                  className="group p-6 rounded-lg shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 bg-card"
                >
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-5">
                    <f.icon className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default FeaturesSection;
