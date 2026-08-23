import { useState } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import SocialProofSection from "@/components/landing/SocialProofSection";
import TrustSection from "@/components/landing/TrustSection";
import Footer from "@/components/landing/Footer";
import RoleToggle from "@/components/landing/RoleToggle";

type Role = "customer" | "vendor";

const Index = () => {
  const [role, setRole] = useState<Role>("customer");

  return (
    <div className="min-h-screen bg-background">
      <Navbar role={role} onRoleChange={setRole} />

      {/* Mobile toggle */}
      <div className="md:hidden flex justify-center pt-20 pb-0 px-6">
        <RoleToggle role={role} onRoleChange={setRole} />
      </div>

      <HeroSection role={role} />
      <HowItWorksSection role={role} />
      <FeaturesSection role={role} />
      <SocialProofSection role={role} />
      <TrustSection role={role} />
      <Footer />
    </div>
  );
};

export default Index;
