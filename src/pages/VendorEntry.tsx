import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import VendorSignup from "./VendorSignup";

/**
 * Gates access to the Vendor Signup flow.
 * - Authed + role=vendor → /vendor/dashboard
 * - Authed + role≠vendor → friendly "not a vendor" message
 * - Not authed → render Vendor Signup Step 1
 */
const VendorEntry = () => {
  const { user, loading } = useAuth();
  const [roleLoading, setRoleLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }
      setRoleLoading(true);
      // profiles.role is the single source of role truth in this app
      // (RoleGuard and post-login routing use the same column).
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setRole(error ? null : (data?.role ?? "customer"));
      setRoleLoading(false);
    };
    fetchRole();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (user && role === "vendor") {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  if (user && role && role !== "vendor") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-muted/30">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight mb-2">
            Not a vendor account
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            This account is not registered as a vendor.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:-translate-y-0.5 transition-all"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Not authenticated → show Step 1 of Vendor Signup
  return <VendorSignup />;
};

export default VendorEntry;
