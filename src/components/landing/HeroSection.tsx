import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

type Role = "customer" | "vendor";

const content = {
  customer: {
    heading: "Rent the look.\nOwn the moment.",
    subtext: "Browse curated fashion from verified rental stores. Select your dates, send a request, and get it delivered — all from one platform.",
    cta: "Browse Rentals",
    ctaSecondary: "How ROOP Works",
  },
  vendor: {
    heading: "Digitize your rental store.\nReach more customers.",
    subtext: "List your inventory, manage bookings, and confirm payments — all from a single dashboard built for fashion rental businesses.",
    cta: "Join as a Vendor",
    ctaSecondary: "See How It Works",
  },
};

const HeroSection = ({ role }: { role: Role }) => {
  const c = content[role];

  return (
    <section className="section-padding pt-32 md:pt-44">
      <div className="container-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
            className="max-w-4xl"
          >
            <h1 className="heading-l1 mb-6 whitespace-pre-line">{c.heading}</h1>
            <p className="body-l2 mb-10">{c.subtext}</p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              {role === "customer" ? (
                <Link to="/explore" className="bg-foreground text-background px-8 py-3.5 rounded-lg text-base font-medium hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
                  {c.cta}
                </Link>
              ) : (
                <Link to="/vendor/signup-step-1" className="bg-foreground text-background px-8 py-3.5 rounded-lg text-base font-medium hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
                  Start Your Store on ROOP
                </Link>
              )}
              <button className="text-muted-foreground hover:text-foreground px-8 py-3.5 rounded-lg text-base font-medium transition-colors">
                {c.ctaSecondary} →
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default HeroSection;
