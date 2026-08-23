import { useEffect, useState } from "react";
import { Upload, X } from "lucide-react";
import VendorTopBar from "@/components/vendor/VendorTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const Field = ({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
      {hint ? <span className="text-xs text-muted-foreground font-normal"> ({hint})</span> : null}
    </Label>
    {children}
  </div>
);

const VendorSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [description, setDescription] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [lineId, setLineId] = useState("");
  const [instagram, setInstagram] = useState("");
  const [rentalPolicy, setRentalPolicy] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [policyImages, setPolicyImages] = useState<string[]>([]);
  const [newPolicyFiles, setNewPolicyFiles] = useState<File[]>([]);

  const [logoFile, setLogoFile] = useState<File | null>(null);


  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", uid)
      .maybeSingle();
    if (data) {
      setFullName((data as any).full_name ?? "");
      setContactEmail((data as any).email ?? "");
      setPhone((data as any).phone ?? "");
    }
  };

  const loadVendor = async (uid: string) => {
    const { data, error } = await supabase
      .from("vendors")
      .select(
        "id, store_name, store_category, description, store_address, subdistrict, city, postal_code, line_id, instagram, logo_url, rental_details_policy, rental_policy_image_urls"
      )


      .eq("owner_id", uid)
      .maybeSingle();
    if (error) {
      setLoadError(true);
      toast({
        title: "Could not load store profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setLoadError(false);

    if (data) {
      setVendorId(data.id);
      setStoreName(data.store_name ?? "");
      setStoreCategory(data.store_category ?? "");
      setDescription(data.description ?? "");
      setStoreAddress(data.store_address ?? "");
      setSubdistrict(data.subdistrict ?? "");
      setCity(data.city ?? "");
      setPostalCode(data.postal_code ?? "");
      setLineId((data as any).line_id ?? "");
      setInstagram((data as any).instagram ?? "");
      setRentalPolicy((data as any).rental_details_policy ?? "");
      setPolicyImages(((data as any).rental_policy_image_urls as string[] | null) ?? []);
      setNewPolicyFiles([]);
      setLogoUrl(data.logo_url ?? null);

    }

  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await loadProfile(user.id);
      await loadVendor(user.id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);


  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    if (contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
      toast({ title: "Enter a valid contact email", variant: "destructive" });
      return;
    }
    if (!storeName.trim()) {
      toast({ title: "Store name is required", variant: "destructive" });
      return;
    }
    if (!vendorId || !user) return;



    setSaving(true);
    try {
      let nextLogo = logoUrl;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${user.id}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("vendor-logos")
          .upload(path, logoFile, { upsert: false, contentType: logoFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("vendor-logos").getPublicUrl(path);
        nextLogo = pub.publicUrl;
      }

      // Optional store-level policy images (public bucket, vendor-owned folder).
      const uploadedPolicyUrls: string[] = [];
      for (const f of newPolicyFiles) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${user.id}/policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("vendor-logos")
          .upload(path, f, { upsert: false, contentType: f.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("vendor-logos").getPublicUrl(path);
        uploadedPolicyUrls.push(pub.publicUrl);
      }
      const nextPolicyImages = [...policyImages, ...uploadedPolicyUrls].slice(0, 10);



      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          email: contactEmail.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      const { error } = await supabase
        .from("vendors")
        .update({
          store_name: storeName.trim(),
          store_category: storeCategory.trim() || null,
          description: description.trim() || null,
          store_address: storeAddress.trim() || null,
          subdistrict: subdistrict.trim() || null,
          city: city.trim() || null,
          postal_code: postalCode.trim() || null,
          line_id: lineId.trim() || null,
          instagram: instagram.trim() || null,
          rental_details_policy: rentalPolicy.trim() || null,
          rental_policy_image_urls: nextPolicyImages.length ? nextPolicyImages : null,
          logo_url: nextLogo,


          updated_at: new Date().toISOString(),
        })
        .eq("id", vendorId)
        .eq("owner_id", user.id);
      if (error) throw error;

      setLogoFile(null);
      setNewPolicyFiles([]);

      await loadProfile(user.id);
      await loadVendor(user.id);
      toast({ title: "Vendor settings updated" });
    } catch (err: any) {
      toast({
        title: "Could not update vendor settings. Please try again.",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <VendorTopBar storeName={storeName} />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Vendor Settings</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Update your account and store information.
        </p>


        {loading ? (
          <div className="text-sm text-muted-foreground">Loading store profile…</div>
        ) : loadError ? (
          <div className="text-sm text-destructive">
            Could not load your store profile. Please refresh and try again.
          </div>
        ) : !vendorId ? (
          <div className="text-sm text-muted-foreground">No store profile found for this account.</div>

        ) : (
          <form onSubmit={save} className="bg-background border border-border rounded-2xl p-5 md:p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Account Details</h2>
              <p className="text-xs text-muted-foreground">Private to you — never shown on customer-facing pages.</p>
            </div>

            <Field label="Full Name" required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Contact Email">
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="store@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  This email is used for vendor contact/profile information. Login email changes are not supported in
                  this MVP.
                </p>
              </Field>
              <Field label="Phone Number" hint="Optional">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080 000 0000" />
              </Field>
            </div>

            <div className="pt-2 border-t border-border">
              <h2 className="text-base font-semibold mt-4">Store Profile</h2>
              <p className="text-xs text-muted-foreground">Shown to customers in the catalogue.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <Field label="Store Name" required>
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Vintage Fashion Hub" />
              </Field>
              <Field label="Store Category" hint="Optional">
                <Input value={storeCategory} onChange={(e) => setStoreCategory(e.target.value)} placeholder="Fashion & Clothing" />
              </Field>
            </div>

            <Field label="Store Description" hint="Optional">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your store and what makes it special…"
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Preferred Address" hint="Optional">
                <Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="456 Fashion Street" />
              </Field>
              <Field label="Subdistrict" hint="Optional">
                <Input value={subdistrict} onChange={(e) => setSubdistrict(e.target.value)} placeholder="e.g. Khlong Tan Nuea" />
              </Field>
              <Field label="City" hint="Optional">
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bangkok" />
              </Field>
              <Field label="Postal Code" hint="Optional">
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="10110" />
              </Field>
            </div>


            <Field label="Store LINE ID" hint="Optional">
              <Input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="e.g. @rentchom or rentchom" />
            </Field>

            <Field label="Store Instagram" hint="Optional">
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="e.g. @rentchom" />
            </Field>

            <div className="pt-2 border-t border-border">
              <h2 className="text-base font-semibold mt-4">Rental Details &amp; Policy</h2>
              <p className="text-xs text-muted-foreground">
                Add store-level rental instructions that customers should know before sending a booking request.
              </p>
            </div>

            <Field label="Rental Details & Policy" hint="Optional">
              <Textarea
                rows={5}
                value={rentalPolicy}
                onChange={(e) => setRentalPolicy(e.target.value)}
                placeholder="Example: Please handle items with care. Return items by the required return date. Late returns may affect future rentals. Return delivery fee is paid separately by the customer."
              />
            </Field>

            <Field label="Policy Images" hint="Optional">
              <p className="text-xs text-muted-foreground">
                Upload optional images that explain your rental guidelines, return rules, or store policies. These
                will be shown to customers before they send a booking request.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG or WebP (max. 2MB each, up to 10 images)
              </p>
              <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors bg-muted/20">
                <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload policy images</p>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    const tooBig = files.filter((f) => f.size > 2 * 1024 * 1024);
                    if (tooBig.length) {
                      toast({ title: "Some images are too large", description: "Max 2MB per image", variant: "destructive" });
                    }
                    const ok = files.filter((f) => f.size <= 2 * 1024 * 1024);
                    const room = 10 - (policyImages.length + newPolicyFiles.length);
                    if (room <= 0) {
                      toast({ title: "You can upload up to 10 policy images.", variant: "destructive" });
                      return;
                    }
                    setNewPolicyFiles((prev) => [...prev, ...ok.slice(0, room)]);
                  }}
                />
              </label>

              {(policyImages.length > 0 || newPolicyFiles.length > 0) && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {policyImages.map((url, idx) => (
                    <div key={url} className="relative group">
                      <img
                        src={url}
                        alt={`Policy image ${idx + 1}`}
                        className="h-24 w-full rounded-lg object-cover border border-border"
                      />
                      <button
                        type="button"
                        aria-label={`Remove policy image ${idx + 1}`}
                        onClick={() => setPolicyImages((prev) => prev.filter((u) => u !== url))}
                        className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {newPolicyFiles.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="relative">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="h-24 w-full rounded-lg object-cover border border-dashed border-primary/50"
                      />
                      <button
                        type="button"
                        aria-label={`Remove pending image ${idx + 1}`}
                        onClick={() => setNewPolicyFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {newPolicyFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {newPolicyFiles.length} new image{newPolicyFiles.length > 1 ? "s" : ""} will be uploaded when you save.
                </p>
              )}
            </Field>




            <Field label="Store Logo" hint="Optional">
              <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors bg-muted/20">
                <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {logoFile ? logoFile.name : logoUrl ? "Replace current logo" : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG or SVG (max. 2MB)</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 2 * 1024 * 1024) {
                      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
                      return;
                    }
                    setLogoFile(f ?? null);
                  }}
                />
              </label>
              {logoUrl && !logoFile && (
                <img src={logoUrl} alt="Current store logo" className="mt-2 h-14 w-14 rounded-lg object-cover border border-border" />
              )}
            </Field>

            <Button type="submit" className="w-full h-11" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default VendorSettings;
