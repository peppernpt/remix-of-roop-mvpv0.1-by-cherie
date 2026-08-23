import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve the route a user should land on after authentication.
 * Always derives the destination from profiles.role so a vendor account
 * never lands on customer pages and vice-versa.
 *
 * `fallback` is honoured ONLY when it points inside the role's own portal
 * (e.g. a customer was redirected from /booking/:id → return them there).
 */
export const resolvePostLoginRoute = async (
  userId: string,
  fallback?: string
): Promise<string> => {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const isVendor = data?.role === "vendor";
  const home = isVendor ? "/vendor/dashboard" : "/home";

  if (!fallback || fallback === "/" || fallback.startsWith("/auth")) return home;

  const isVendorPath = fallback.startsWith("/vendor");
  // Only honour fallback when it matches the role's portal
  if (isVendor && isVendorPath) return fallback;
  if (!isVendor && !isVendorPath) return fallback;
  return home;
};
