import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { resolvePostLoginRoute } from "@/lib/post-login";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

/**
 * Landing page for the password-recovery email link.
 * Supabase signs the user in with a recovery session; this page sets the new
 * password and sends them to their portal.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // The recovery link signs the user in via the URL hash; give the client a
    // beat to process it, then check.
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(!!data.session);
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(true);
        setReady(true);
      }
    });
    const t = setTimeout(check, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fieldErr: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (fieldErr[i.path[0] as string] = i.message));
      setErrors(fieldErr);
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated", description: "You're signed in with your new password." });
    const dest = data.user ? await resolvePostLoginRoute(data.user.id) : "/home";
    navigate(dest, { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <KeyRound className="w-5 h-5" />
          <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground mt-4">Checking your reset link…</p>
        ) : !hasSession ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button asChild className="mt-5 w-full h-11">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-4" noValidate>
            <div>
              <Label htmlFor="new-password" className="text-xs font-medium mb-1.5 block">
                New password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-xs font-medium mb-1.5 block">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11"
              />
              {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm}</p>}
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12">
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
