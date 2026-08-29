import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Role = "customer" | "vendor";

// In-memory role cache per user id: avoids a full-screen loader + refetch on
// every guarded navigation. Cleared when the user changes; a role change mid-
// session is picked up on the next hard load, which is acceptable here.
const roleCache = new Map<string, Role>();

interface Props {
  allow: Role;
  children: ReactNode;
}

/**
 * Route guard: ensures the signed-in user's `profiles.role` matches `allow`.
 * - Not signed in → /auth/login?redirect=...
 * - Wrong role     → vendor → /vendor/dashboard, customer → /home
 * - Role lookup fails → error screen (never silently defaults into a portal)
 */
const RoleGuard = ({ allow, children }: Props) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cached = user ? roleCache.get(user.id) : undefined;
  const [checking, setChecking] = useState(!cached);
  const [ok, setOk] = useState(cached === allow);
  const [failed, setFailed] = useState(false);

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

    const known = roleCache.get(user.id);
    if (known) {
      if (known === allow) {
        setOk(true);
        setChecking(false);
      } else {
        navigate(known === "vendor" ? "/vendor/dashboard" : "/home", { replace: true });
      }
      return;
    }

    (async () => {
      setChecking(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // A failed lookup must not quietly admit the user into either portal.
        setFailed(true);
        setChecking(false);
        return;
      }
      const role = (data?.role as Role | undefined) ?? "customer";
      roleCache.set(user.id, role);
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

  if (failed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Connection problem</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We couldn't verify your account. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-10 px-5 rounded-lg bg-foreground text-background text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
