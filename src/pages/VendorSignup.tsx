import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Store, Check, Eye, EyeOff, Upload } from "lucide-react";
import BackButton from "@/components/BackButton";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { stashPendingStore, clearPendingStore } from "@/lib/pending-profile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const step1Schema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required").max(120),
    email: z.string().trim().email("Invalid email").max(255),
    phone: z.string().trim().min(6, "Phone is required").max(40),
    password: z.string().min(8, "Min 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type Step1Data = z.infer<typeof step1Schema>;

const VendorSignup = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1, setStep1] = useState<Step1Data | null>(null);

  // Already signed in: this form would create a SECOND account. Send existing
  // users to the authenticated store-setup flow instead.
  if (!loading && user) {
    return <Navigate to="/vendor/setup" replace />;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto h-14 px-4 flex items-center justify-between">
          <BackButton fallback="/" />
          <span className="text-lg font-semibold tracking-tight uppercase">ROOP · Vendor</span>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          <Stepper step={step} />
          <div className="mt-6 bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-3">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {step === 1 ? "Vendor Registration" : "Store Information"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {step === 1
                  ? "Step 1: Account Details"
                  : "Step 2: Complete your store profile"}
              </p>
            </div>

            {step === 1 ? (
              <Step1Form
                initial={step1}
                onNext={(data) => {
                  setStep1(data);
                  setStep(2);
                }}
              />
            ) : (
              <Step2Form
                step1={step1!}
                onBack={() => setStep(1)}
                onComplete={() => navigate("/vendor/dashboard", { replace: true })}
              />
            )}
          </div>

          {step === 1 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have a vendor account?{" "}
              <Link to="/auth?redirect=/vendor/dashboard" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

const Stepper = ({ step }: { step: 1 | 2 }) => (
  <div className="flex items-center justify-center gap-3">
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border",
        step >= 1 ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
      )}
    >
      {step > 1 ? <Check className="w-4 h-4" /> : 1}
    </div>
    <div className={cn("h-px w-16", step === 2 ? "bg-primary" : "bg-border")} />
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border",
        step === 2 ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
      )}
    >
      2
    </div>
  </div>
);

// ========== Step 1 ==========
const Step1Form = ({
  initial,
  onNext,
}: {
  initial: Step1Data | null;
  onNext: (data: Step1Data) => void;
}) => {
  const [form, setForm] = useState<Step1Data>(
    initial ?? { fullName: "", email: "", phone: "", password: "", confirmPassword: "" }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPwd, setShowPwd] = useState(false);

  const update = (k: keyof Step1Data, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = step1Schema.safeParse(form);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    onNext(r.data);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full Name" error={errors.fullName}>
        <Input
          placeholder="John Smith"
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
        />
      </Field>
      <Field label="Email Address" error={errors.email}>
        <Input
          type="email"
          placeholder="john.smith@example.com"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />
      </Field>
      <Field label="Phone Number" error={errors.phone}>
        <Input
          placeholder="+66 81 234 5678"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
        />
      </Field>
      <Field label="Password" error={errors.password}>
        <div className="relative">
          <Input
            type={showPwd ? "text" : "password"}
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Field>
      <Field label="Confirm Password" error={errors.confirmPassword}>
        <Input
          type={showPwd ? "text" : "password"}
          placeholder="Re-enter password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full h-11 mt-2">
        Next Step →
      </Button>
    </form>
  );
};

// ========== Step 2 ==========
const Step2Form = ({
  step1,
  onBack,
  onComplete,
}: {
  step1: Step1Data;
  onBack: () => void;
  onComplete: () => void;
}) => {
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

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast({ title: "Store name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // 1) Create auth user with vendor role in metadata
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: step1.email,
        password: step1.password,
        options: {
          emailRedirectTo: `${window.location.origin}/vendor/setup`,
          data: {
            full_name: step1.fullName,
            phone: step1.phone,
            role: "vendor",
          },
        },
      });
      if (signUpErr) throw signUpErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Account creation failed");

      // Duplicate email: Supabase returns a user with no identities.
      if (!authData.session && (authData.user?.identities?.length ?? 0) === 0) {
        toast({
          title: "This email is already registered",
          description:
            "Sign in with this email, then finish your store at Vendor Dashboard \u2192 Set up your store.",
          variant: "destructive",
        });
        return;
      }

      // 2) If session was returned (email confirmation off), upload logo and create vendor row
      if (authData.session) {
        clearPendingStore(step1.email);
        let logoUrl: string | null = null;
        if (logoFile) {
          const ext = logoFile.name.split(".").pop() || "png";
          const path = `${userId}/logo-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("vendor-logos")
            .upload(path, logoFile, { upsert: true });
          if (upErr) {
            console.warn("Logo upload failed:", upErr.message);
          } else {
            const { data: pub } = supabase.storage.from("vendor-logos").getPublicUrl(path);
            logoUrl = pub.publicUrl;
          }
        }

        const storePayload = {
          store_name: storeName.trim(),
          logo_url: logoUrl,
          subdistrict: subdistrict.trim() || null,
          city: city.trim() || null,
          description: storeDescription.trim() || null,
          store_category: storeCategory.trim() || null,
          store_address: storeAddress.trim() || null,
          postal_code: postalCode.trim() || null,
          line_id: lineId.trim() || null,
          instagram: instagram.trim() || null,
          rental_details_policy: rentalPolicy.trim() || null,
          deposit_per_item: 0,
          is_active: true,
        };
        // Preferred: the provisioning RPC (creates the store + grants the
        // vendor role atomically). Older databases fall back to direct insert.
        const { error: rpcErr } = await supabase.rpc(
          "create_vendor_store" as never,
          { _store: storePayload } as never,
        );
        if (rpcErr) {
          const missingFn = /create_vendor_store|function|schema cache/i.test(rpcErr.message ?? "");
          if (!missingFn) throw rpcErr;
          const { error: vendorErr } = await supabase
            .from("vendors")
            .insert({ owner_id: userId, ...storePayload });
          if (vendorErr) throw vendorErr;
        }

        toast({ title: "Welcome to ROOP", description: "Your vendor store is ready." });
        onComplete();
      } else {
        // Email confirmation required — the store details are stashed (keyed by
        // email, in localStorage so they survive the round trip) and applied on
        // /vendor/setup after the first sign-in.
        stashPendingStore(step1.email, {
          storeName,
          storeCategory,
          storeDescription,
          storeAddress,
          subdistrict,
          city,
          postalCode,
          lineId,
          instagram,
          rentalPolicy,
        });
        toast({
          title: "Check your email",
          description:
            "Confirm your email, sign in, and your store details will be waiting on the setup page.",
        });
        onComplete();
      }
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.message ?? "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Store Name" required>
          <Input
            placeholder="Vintage Fashion Hub"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
        </Field>
        <Field label="Store Category" hint="Optional">
          <Input
            placeholder="Fashion & Clothing"
            value={storeCategory}
            onChange={(e) => setStoreCategory(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Store Description" hint="Optional">
        <Textarea
          placeholder="Describe your store and what makes it special…"
          rows={3}
          value={storeDescription}
          onChange={(e) => setStoreDescription(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Preferred Address" hint="Optional">
          <Input
            placeholder="456 Fashion Street"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
          />
        </Field>
        <Field label="Subdistrict" hint="Optional">
          <Input
            placeholder="e.g. Khlong Tan Nuea"
            value={subdistrict}
            onChange={(e) => setSubdistrict(e.target.value)}
          />
        </Field>
        <Field label="City" hint="Optional">
          <Input
            placeholder="Bangkok"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </Field>
        <Field label="Postal Code" hint="Optional">
          <Input
            placeholder="10110"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Store LINE ID" hint="Optional">
          <Input
            placeholder="e.g. @rentchom or rentchom"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
          />
        </Field>
        <Field label="Store Instagram" hint="Optional">
          <Input
            placeholder="e.g. @rentchom"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
          />
        </Field>
      </div>

      <div className="pt-2 border-t border-border">
        <h2 className="text-base font-semibold mt-2">Rental Details &amp; Policy</h2>
        <p className="text-xs text-muted-foreground">
          Add store-level rental instructions that customers should know before sending a booking request. You can edit
          this later in Vendor Settings.
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

      <p className="text-xs text-muted-foreground -mt-2">
        Policy Images: you can upload policy images later in Vendor Settings.
      </p>




      <Field label="Store Logo" hint="Optional">
        <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors bg-muted/20">
          <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {logoFile ? logoFile.name : "Click to upload or drag and drop"}
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
      </Field>

      <div className="space-y-2 pt-2">
        <Button type="submit" className="w-full h-11" disabled={submitting}>
          {submitting ? "Creating account…" : "Complete Registration ✓"}
        </Button>
        <Button type="button" variant="outline" className="w-full h-11" onClick={onBack} disabled={submitting}>
          Previous Step
        </Button>
      </div>
    </form>
  );
};

const Field = ({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export default VendorSignup;
