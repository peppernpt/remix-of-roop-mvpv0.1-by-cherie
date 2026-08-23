import { motion, AnimatePresence } from "framer-motion";
import { Search, Send, PackageCheck, RotateCcw, ListPlus, ClipboardCheck, CreditCard, Truck } from "lucide-react";

type Role = "customer" | "vendor";

const steps = {
  customer: [
    { icon: Search, title: "Browse", description: "Explore curated collections from verified rental stores." },
    { icon: Send, title: "Request", description: "Pick your dates and send a rental request to the store." },
    { icon: PackageCheck, title: "Receive", description: "Get your items delivered and enjoy your rental period." },
    { icon: RotateCcw, title: "Return", description: "Send items back when your rental window ends." },
  ],
  vendor: [
    { icon: ListPlus, title: "List", description: "Add your products and inventory to your ROOP storefront." },
    { icon: ClipboardCheck, title: "Manage", description: "Approve requests, track inventory at the serial level." },
    { icon: CreditCard, title: "Confirm", description: "Manually confirm payments and input delivery fees." },
    { icon: Truck, title: "Fulfill", description: "Ship items and track the full rental lifecycle." },
  ],
};

const HowItWorksSection = ({ role }: { role: Role }) => {
  return (
    <section className="section-padding">
      <div className="container-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          >
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              How it works
            </p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-16" style={{ letterSpacing: "-0.01em" }}>
              {role === "customer"
                ? "Four simple steps to your next outfit."
                : "Get your store online in minutes."}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {steps[role].map((step, i) => (
                <div key={step.title} className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    {i < steps[role].length - 1 && (
                      <div className="hidden md:block absolute top-4 left-12 w-[calc(100%-3rem)] h-px bg-border" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default HowItWorksSection;
