import { motion, AnimatePresence } from "framer-motion";

type Role = "customer" | "vendor";

const TrustSection = ({ role }: { role: Role }) => {
  return (
    <section className="section-padding bg-foreground text-background">
      <div className="container-main text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          >
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight mx-auto mb-6" style={{ letterSpacing: "-0.02em", maxWidth: "28ch" }}>
              {role === "customer"
                ? "The smarter way to wear more."
                : "The future of fashion rental is digital."}
            </h2>
            <p className="text-lg opacity-70 mb-10 max-w-xl mx-auto">
              {role === "customer"
                ? "Stop buying, start renting. Access the wardrobes you've always wanted."
                : "Join ROOP and transform your rental store into a scalable online business."}
            </p>
            <button className="bg-background text-foreground px-8 py-3.5 rounded-lg text-base font-medium hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200">
              {role === "customer" ? "Browse Rentals" : "Join as a Vendor"}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default TrustSection;
