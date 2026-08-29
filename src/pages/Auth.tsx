import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, Check, UserRound } from "lucide-react";
import BackButton from "@/components/BackButton";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { stashPendingCustomerProfile } from "@/lib/pending-profile";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "signup";

const Auth = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  const pathMode: Mode | null = location.pathname.endsWith("/signup")
    ? "signup"
    : location.pathname.endsWith("/login")
    ? "login"
    : null;
  const initialMode = pathMode ?? ((params.get("mode") as Mode) ?? "login");
  const redirectParam = params.get("redirect") ?? "";

  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);

  // Redirect logged-in users by role
  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { resolvePostLoginRoute } = await import("@/lib/post-login");
      const dest = await resolvePostLoginRoute(user.id, redirectParam);
      navigate(dest, { replace: true });
    })();
  }, [user, loading, navigate, redirectParam]);

  const isSignup = mode === "signup";

  return (
    <div className={cn("min-h-screen flex flex-col", isSignup ? "bg-muted/30" : "bg-background")}>
      {/* Header */}
      <header className={cn("border-b border-border", isSignup && "bg-background")}>
        <div className={cn("flex items-center justify-between px-4", isSignup ? "max-w-3xl mx-auto h-14" : "container-main h-16")}>
          <BackButton fallback={redirectParam || "/"} />
          <span className={cn("font-semibold tracking-tight uppercase", isSignup ? "text-lg" : "text-xl font-bold")}>
            {isSignup ? "ROOP · Customer" : "ROOP"}
          </span>
          <div className="w-12" />
        </div>
      </header>

      <main className={cn("flex-1 flex items-start justify-center px-4", isSignup ? "py-10" : "py-10 md:py-16")}>
        <div className={cn("w-full", isSignup ? "max-w-xl" : "max-w-md")}>
          {mode === "login" ? (
            <LoginForm onSwitchToSignup={() => setMode("signup")} redirect={redirectParam} />
          ) : (
            <SignupFlow onSwitchToLogin={() => setMode("login")} redirect={redirectParam} />
          )}
        </div>
      </main>
    </div>
  );
};


export default Auth;

// ==============================================================
// LOGIN
// ==============================================================
const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const LoginForm = ({
  onSwitchToSignup,
  redirect,
}: {
  onSwitchToSignup: () => void;
  redirect: string;
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const sendReset = async () => {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      setErrors({ email: "Enter your email above first, then tap \u201cForgot password\u201d." });
      return;
    }
    setErrors({});
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setSendingReset(false);
    if (error) {
      toast({ title: "Couldn't send reset email", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Reset email sent",
      description: "Check your inbox for a link to set a new password.",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErr: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (fieldErr[i.path[0] as string] = i.message));
      setErrors(fieldErr);
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome back" });
    const { resolvePostLoginRoute } = await import("@/lib/post-login");
    const dest = await resolvePostLoginRoute(data.user!.id, redirect);
    navigate(dest, { replace: true });
  };

  const isBookingRedirect = redirect.startsWith("/booking/");

  return (
    <div>
      <h1 className="text-3xl font-medium tracking-tight mb-2">Welcome back</h1>
      <p className="text-sm text-muted-foreground mb-1">Sign in to continue.</p>
      {isBookingRedirect && (
        <p className="text-xs text-muted-foreground mb-8 flex items-start gap-1.5">
          <Lock className="w-3 h-3 mt-0.5 shrink-0" />
          Login is required before sending your booking request.
        </p>
      )}
      {!isBookingRedirect && <div className="mb-8" />}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email" className="text-xs font-medium mb-1.5 block">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11"
          />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>
        <div>
          <Label htmlFor="password" className="text-xs font-medium mb-1.5 block">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
          <div className="text-right mt-1.5">
            <button
              type="button"
              onClick={sendReset}
              disabled={sendingReset}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {sendingReset ? "Sending reset email…" : "Forgot password?"}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full h-12 mt-2">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-8">
        New to ROOP?{" "}
        {redirect.startsWith("/vendor") ? (
          <Link
            to="/auth?mode=signup"
            className="text-foreground font-medium hover:underline"
          >
            Create an account
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-foreground font-medium hover:underline"
          >
            Create an account
          </button>
        )}
      </p>
    </div>
  );
};

// ==============================================================
// SIGNUP — 2 steps
// ==============================================================
const step1Schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(50),
  lastName: z.string().trim().min(1, "Required").max(50),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone").max(20),
  lineId: z.string().trim().max(50).optional().or(z.literal("")),
  instagram: z.string().trim().max(50).optional().or(z.literal("")),
  username: z
    .string()
    .trim()
    .min(3, "Min 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/, "Letters, numbers, _ and . only"),
  password: z
    .string()
    .min(8, "Min 8 characters")
    .max(72)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

const step2Schema = z.object({
  address: z.string().trim().min(5, "Enter a full address").max(300),
  city: z.string().trim().min(1, "Please enter your city.").max(100),
  postcode: z.string().trim().min(4, "Enter a valid postcode").max(10),

  agreed: z.literal(true, { errorMap: () => ({ message: "You must agree to continue" }) }),
  testPasswordAck: z.literal(true, {
    errorMap: () => ({ message: "Please acknowledge the test-only password rule" }),
  }),
});

interface Step1Data {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  lineId: string;
  instagram: string;
  username: string;
  password: string;
}

const SignupStepper = ({ step }: { step: 1 | 2 }) => (
  <div className="flex items-center justify-center gap-3">
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border",
        step >= 1
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border"
      )}
    >
      {step > 1 ? <Check className="w-4 h-4" /> : 1}
    </div>
    <div className={cn("h-px w-16", step === 2 ? "bg-primary" : "bg-border")} />
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border",
        step === 2
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-border"
      )}
    >
      2
    </div>
  </div>
);

const SignupFlow = ({
  onSwitchToLogin,
  redirect,
}: {
  onSwitchToLogin: () => void;
  redirect: string;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1, setStep1] = useState<Step1Data>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    lineId: "",
    instagram: "",
    username: "",
    password: "",
  });

  return (
    <div>
      <SignupStepper step={step} />

      <div className="mt-6 bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-3">
            <UserRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer Registration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1 ? "Step 1: Account Details" : "Step 2: Delivery Information"}
          </p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mt-2">
            Step {step} of 2
          </p>
        </div>

        {step === 1 ? (
          <SignupStep1
            data={step1}
            onChange={setStep1}
            onNext={() => setStep(2)}
            onSwitchToLogin={onSwitchToLogin}
          />
        ) : (
          <SignupStep2 step1={step1} onBack={() => setStep(1)} redirect={redirect} />
        )}
      </div>
    </div>
  );
};


// --------------- Step 1 ----------------------------------------
const SignupStep1 = ({
  data,
  onChange,
  onNext,
  onSwitchToLogin,
}: {
  data: Step1Data;
  onChange: (d: Step1Data) => void;
  onNext: () => void;
  onSwitchToLogin: () => void;
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPwd, setShowPwd] = useState(false);

  const set = <K extends keyof Step1Data>(k: K, v: Step1Data[K]) => onChange({ ...data, [k]: v });


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = step1Schema.safeParse({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      lineId: data.lineId,
      instagram: data.instagram,
      username: data.username,
      password: data.password,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (fe[i.path[0] as string] = i.message));
      setErrors(fe);
      return;
    }
    setErrors({});
    onNext();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>


      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          value={data.firstName}
          onChange={(v) => set("firstName", v)}
          error={errors.firstName}
          placeholder="John"
        />
        <Field
          label="Last name"
          value={data.lastName}
          onChange={(v) => set("lastName", v)}
          error={errors.lastName}
          placeholder="Doe"
        />
      </div>

      <Field
        label="Email address"
        type="email"
        value={data.email}
        onChange={(v) => set("email", v)}
        error={errors.email}
        placeholder="you@example.com"
      />

      <Field
        label="Phone number"
        type="tel"
        value={data.phone}
        onChange={(v) => set("phone", v)}
        error={errors.phone}
        placeholder="+66 234 567 890"
      />

      <Field
        label="LINE ID"
        value={data.lineId}
        onChange={(v) => set("lineId", v)}
        error={errors.lineId}
        placeholder="e.g. roop.user"
      />

      <Field
        label="Instagram"
        value={data.instagram}
        onChange={(v) => set("instagram", v)}
        error={errors.instagram}
        placeholder="e.g. @roop.user"
      />

      <Field
        label="Username"
        value={data.username}
        onChange={(v) => set("username", v)}
        error={errors.username}
        placeholder="johndoe123"
      />

      <div>
        {/* Test-password safety notice */}
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-950/30">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Important for testing
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200/80 mt-1 leading-relaxed">
            Please create a new password just for ROOP testing.
            <br />
            Do not use the same password as your email, banking, university, social media, or any important account.
          </p>
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium mb-1.5 block">Password</Label>
        <div className="relative">
          <Input
            type={showPwd ? "text" : "password"}
            value={data.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="••••••••"
            className="h-11 pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPwd ? "Hide password" : "Show password"}
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-destructive mt-1">{errors.password}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Use a test-only password that you do not use anywhere else.
            <br />
            8+ characters with an uppercase letter and a number.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full h-11 mt-2">
        Next Step →
      </Button>

      <p className="text-sm text-muted-foreground text-center pt-2">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-foreground font-medium hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
};

// --------------- Step 2 ----------------------------------------
const SignupStep2 = ({
  step1,
  onBack,
  redirect,
}: {
  step1: Step1Data;
  onBack: () => void;
  redirect: string;
}) => {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [testPasswordAck, setTestPasswordAck] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = step2Schema.safeParse({
      address,
      city,
      postcode,
      agreed,
      testPasswordAck,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (fe[i.path[0] as string] = i.message));
      setErrors(fe);
      return;
    }
    setErrors({});
    setBusy(true);

    try {
      // 1) Create the auth user — profile auto-created by DB trigger.
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: step1.email,
        password: step1.password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirect}`,
          data: {
            full_name: `${step1.firstName} ${step1.lastName}`.trim(),
            phone: step1.phone,
            username: step1.username,
            line_id: step1.lineId || null,
            instagram_username: step1.instagram || null,
          },
        },
      });
      if (signUpErr) throw signUpErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Signup did not return a user id");

      // Supabase obfuscates duplicate-email signups: an existing email comes
      // back as a user with no identities. Don't report that as a new account.
      if (!authData.session && (authData.user?.identities?.length ?? 0) === 0) {
        toast({
          title: "This email is already registered",
          description: "Sign in instead \u2014 or use \u201cForgot password\u201d if you can\u2019t remember it.",
          variant: "destructive",
        });
        return;
      }

      // The session may not exist yet if email confirmation is on.
      const hasSession = !!authData.session;

      // 2) Update profile (no avatar upload during MVP signup)
      if (hasSession) {
        await supabase
          .from("profiles")
          .update({
            full_name: `${step1.firstName} ${step1.lastName}`.trim(),
            phone: step1.phone,
            username: step1.username,
            email: step1.email,
            line_id: step1.lineId || null,
            instagram_username: step1.instagram || null,
          })
          .eq("id", userId);

        // 4) Insert customer address
        await supabase.from("customer_addresses").insert({
          customer_id: userId,
          address_line1: address,
          city: city.trim(),
          postal_code: postcode,
          country: "TH",
          is_default: true,
        });
      } else {
        // Email confirmation pending: keep the typed details and apply them on
        // the first authenticated session (see lib/pending-profile.ts).
        stashPendingCustomerProfile(step1.email, {
          fullName: `${step1.firstName} ${step1.lastName}`.trim(),
          phone: step1.phone,
          username: step1.username,
          lineId: step1.lineId || null,
          instagram: step1.instagram || null,
          address,
          city: city.trim(),
          postcode,
        });
      }

      toast({
        title: "Account created",
        description: hasSession
          ? "Welcome to ROOP."
          : "Check your email to confirm your account.",
      });
      navigate(redirect, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Signup failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field
        label="Address"
        value={address}
        onChange={setAddress}
        error={errors.address}
        placeholder="123 Sample Street, District"
        as="textarea"
      />
      <Field
        label="City"
        value={city}
        onChange={setCity}
        error={errors.city}
        placeholder="Bangkok"
      />
      <Field
        label="Postcode"
        value={postcode}
        onChange={setPostcode}
        error={errors.postcode}
        placeholder="10000"
      />



      {/* Terms */}
      <div className="flex items-start gap-2 pt-2">
        <Checkbox
          id="terms"
          checked={agreed}
          onCheckedChange={(v) => setAgreed(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground leading-relaxed">
          I agree to the{" "}
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-foreground underline-offset-2 hover:underline"
          >
            Terms
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-foreground underline-offset-2 hover:underline"
          >
            Privacy Policy
          </button>
          .
        </Label>
      </div>
      {errors.agreed && <p className="text-xs text-destructive">{errors.agreed}</p>}
      <p className="text-xs text-muted-foreground leading-relaxed pl-7">
        Your contact and delivery details are shared only with the store handling your rental
        request and are not shown publicly.
      </p>

      {/* Privacy / data-sharing modal */}
      <PrivacyInfoModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />

      {/* Test-only password acknowledgement */}
      <div className="flex items-start gap-2 pt-2">
        <Checkbox
          id="test-password-ack"
          checked={testPasswordAck}
          onCheckedChange={(v) => setTestPasswordAck(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="test-password-ack"
          className="text-sm font-normal text-muted-foreground leading-relaxed"
        >
          I understand that I should use a test-only password and not reuse my real email or
          personal account password.
        </Label>
      </div>
      {errors.testPasswordAck && (
        <p className="text-xs text-destructive">{errors.testPasswordAck}</p>
      )}

      <div className="space-y-2 pt-2">
        <Button
          type="submit"
          disabled={busy || !agreed || !testPasswordAck}
          className="w-full h-11"
        >
          {busy ? "Creating account…" : "Complete signup"}
        </Button>
        <Button type="button" variant="outline" onClick={onBack} className="w-full h-11" disabled={busy}>
          Back
        </Button>
      </div>
    </form>
  );
};

// --------------- Privacy info modal ----------------------------
const PrivacyInfoModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl font-medium tracking-tight">
          How your information is used
        </DialogTitle>
        <DialogDescription className="sr-only">
          How ROOP uses and shares your customer information during the rental journey.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          To complete a rental, ROOP shares your contact and delivery details with the rental store
          handling your booking.
        </p>
        <p>The store may view your:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email</li>
          <li>LINE ID</li>
          <li>Instagram</li>
          <li>Delivery address</li>
        </ul>
        <p>
          This information is used only to coordinate your rental request, delivery, payment
          confirmation, return process, and customer support.
        </p>
        <p className="font-medium text-foreground">Your details are not shown publicly on ROOP.</p>
      </div>
      <Button type="button" className="w-full h-11 mt-2" onClick={onClose}>
        I understand
      </Button>
    </DialogContent>
  </Dialog>
);

// --------------- Field helper ----------------------------------
const Field = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  as = "input",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  as?: "input" | "textarea";
}) => (
  <div>
    <Label className="text-xs font-medium mb-1.5 block">{label}</Label>
    {as === "textarea" ? (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="resize-none"
      />
    ) : (
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11"
      />
    )}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);
