import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface VendorRow {
  id: string;
  store_name: string;
  owner_id: string;
}

/**
 * Loads the current authenticated user's vendor row.
 * Redirects to /auth if not signed in. Returns vendor=null if signed in but no vendor profile.
 */
export const useVendor = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`, { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vendors")
        .select("id, store_name, owner_id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setVendor((data as VendorRow) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { vendor, loading: authLoading || loading };
};
