import { motion, AnimatePresence } from "framer-motion";

type Role = "customer" | "vendor";

const customerStats = [
  { value: "-", label: "Outfits available" },
  { value: "-", label: "Rental stores" },
  { value: "-", label: "Average rating" },
];

const vendorTestimonials = [
  {
    quote: "Testimonials",
    name: "Store Partner",
    store: "Verified Vendor",
  },
  {
    quote: "Testimonials",
    name: "Store Partner",
    store: "Verified Vendor",
  },
];

const vendorLogos = ["-", "-", "-", "-", "-"];

const SocialProofSection = ({ role }: { role: Role }) => {
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
            {role === "customer" ? (
              <>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Trusted by renters
                </p>
                <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-16 text-center" style={{ letterSpacing: "-0.01em" }}>
                  Join a growing community of fashion renters.
                </h2>
                <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                  {customerStats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{stat.value}</p>
                      <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Trusted by stores
                </p>
                <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-16 text-center" style={{ letterSpacing: "-0.01em" }}>
                  Stores already growing with ROOP.
                </h2>

                {/* Vendor logos placeholder */}
                <div className="flex flex-wrap justify-center gap-6 mb-16">
                  {vendorLogos.map((name) => (
                    <div
                      key={name}
                      className="px-6 py-3 rounded-lg bg-muted text-sm font-medium text-muted-foreground"
                    >
                      {name}
                    </div>
                  ))}
                </div>

                {/* Testimonials */}
                <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  {vendorTestimonials.map((t, i) => (
                    <div key={i} className="p-6 rounded-lg bg-card shadow-card">
                      <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.store}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default SocialProofSection;
