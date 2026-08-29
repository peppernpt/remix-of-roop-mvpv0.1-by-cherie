import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { readPendingStore, clearPendingStore } from "@/lib/pending-profile";

/**
 * Authenticated "create my store" flow.
 *
 * Closes the email-confirmation dead end: a vendor who confirmed their email
 * (or any signed-in user without a store) lands here instead of the public
 * signup form, which would try to create a second account. Prefills from the
 * details stashed during signup when they exist.
 */
const StoreSetup = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [lineId, setLineId] = useState("");
  const [instagram, setInstagram] = useState("");
  const [rentalPolicy, setRentalPolicy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent("/vendor/setup")}`, { replace: true });
    }
  }, [loading, user, navigate]);

  // Already has a store → straight to the dashboard.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        navigate("/vendor/dashboard", { replace: true });
        return;
      }
      setCheckingExisting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  // Prefill from the signup stash (survives the email-confirmation round trip).
  useEffect(() => {
    const pending = readPendingStore(user?.email);
    if (!pending) return;
    setStoreName(pending.storeName ?? "");
    setStoreCategory(pending.storeCategory ?? "");
    setStoreDescription(pending.storeDescription ?? "");
    setStoreAddress(pending.storeAddress ?? "");
    setSubdistrict(pending.subdistrict ?? "");
    setCity(pending.city ?? "");
    setPostalCode(pending.postalCode ?? "");
    setLineId(pending.lineId ?? "");
    setInstagram(pending.instagram ?? "");
    setRentalPolicy(pending.rentalPolicy ?? "");
  }, [user?.email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!storeName.trim()) {
      toast({ title: "Store name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const storePayload = {
        store_name: storeName.trim(),
        store_category: storeCategory.trim() || null,
        description: storeDescription.trim() || null,
        store_address: storeAddress.trim() || null,
        subdistrict: subdistrict.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        line_id: lineId.trim() || null,
        instagram: instagram.trim() || null,
        rental_details_policy: rentalPolicy.trim() || null,
        deposit_per_item: 0,
        is_active: true,
      };

      // Preferred path: the server-side RPC creates the store AND promotes the
      // profile role in one transaction (added by the hardening migration).
      const { error: rpcErr } = await supabase.rpc(
        "create_vendor_store" as never,
        { _store: storePayload } as never,
      );
      if (rpcErr) {
        // Older database without the RPC: fall back to a direct insert, which
        // the vendors RLS policy allows for the owner.
        const missingFn = /create_vendor_store|function|schema cache/i.test(rpcErr.message ?? "");
        if (!missingFn) throw rpcErr;
        const { error: insErr } = await supabase
          .from("vendors")
          .insert({ owner_id: user.id, ...storePayload });
        if (insErr) throw insErr;
      }

      clearPendingStore(user.email);
      toast({ title: "Your store is ready", description: "Welcome to ROOP." });
      // Full reload so RoleGuard re-reads the (possibly just-promoted) role.
      window.location.assign("/vendor/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Couldn't create your store", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <Store className="w-5 h-5" />
          <h1 className="text-xl font-semibold tracking-tight">Set up your store</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          You're signed in as {user?.email}. Fill in your store details to start listing rentals.
        </p>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="store-name" className="text-xs font-medium mb-1.5 block">
              Store name *
            </Label>
            <Input
              id="store-name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Rent.andlooks"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="store-category" className="text-xs font-medium mb-1.5 block">
                Category
              </Label>
              <Input
                id="store-category"
                value={storeCategory}
                onChange={(e) => setStoreCategory(e.target.value)}
                placeholder="Dresses, suits…"
              />
            </div>
            <div>
              <Label htmlFor="store-line" className="text-xs font-medium mb-1.5 block">
                LINE ID
              </Label>
              <Input
                id="store-line"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                placeholder="@yourstore"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="store-desc" className="text-xs font-medium mb-1.5 block">
              Description
            </Label>
            <Textarea
              id="store-desc"
              rows={2}
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              placeholder="Tell customers about your store"
            />
          </div>
          <div>
            <Label htmlFor="store-address" className="text-xs font-medium mb-1.5 block">
              Store address (used as the return address)
            </Label>
            <Input
              id="store-address"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder="House no., street"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="store-subdistrict" className="text-xs font-medium mb-1.5 block">
                Subdistrict
              </Label>
              <Input
                id="store-subdistrict"
                value={subdistrict}
                onChange={(e) => setSubdistrict(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="store-city" className="text-xs font-medium mb-1.5 block">
                City / Province
              </Label>
              <Input id="store-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="store-postal" className="text-xs font-medium mb-1.5 block">
                Postal code
              </Label>
              <Input
                id="store-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="store-instagram" className="text-xs font-medium mb-1.5 block">
              Instagram
            </Label>
            <Input
              id="store-instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="yourstore"
            />
          </div>
          <div>
            <Label htmlFor="store-policy" className="text-xs font-medium mb-1.5 block">
              Rental details &amp; policy (shown to customers)
            </Label>
            <Textarea
              id="store-policy"
              rows={3}
              value={rentalPolicy}
              onChange={(e) => setRentalPolicy(e.target.value)}
              placeholder="Deposits, late fees, damage rules…"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full h-11">
            {submitting ? "Creating store…" : "Create my store"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Not a vendor?{" "}
          <Link to="/home" className="underline hover:text-foreground">
            Go to the customer portal
          </Link>
        </p>
      </div>
    </div>
  );
};

export default StoreSetup;
