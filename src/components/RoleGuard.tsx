import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Role = "customer" | "vendor";

interface Props {
  allow: Role;
  children: ReactNode;
}

/**
 * Route guard: ensures the signed-in user's `profiles.role` matches `allow`.
 * - Not signed in → /auth/login?redirect=...
 * - Wrong role     → vendor → /vendor/dashboard, customer → /home
 */
const RoleGuard = ({ allow, children }: Props) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;

    if (!user) {
      navigate(
        `/auth/login?redirect=${encodeURIComponent(location.pathname + location.search)}`,
        { replace: true }
      );
      return;
    }

    (async () => {
      setChecking(true);
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const role = (data?.role as Role | undefined) ?? "customer";
      if (role === allow) {
        setOk(true);
      } else {
        navigate(role === "vendor" ? "/vendor/dashboard" : "/home", { replace: true });
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, allow, navigate, location.pathname, location.search]);

  if (loading || checking || !ok) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
};

export default RoleGuard;
