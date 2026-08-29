import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setActiveUser, clearCustomerScopedState } from "@/lib/user-scope";
import { completePendingCustomerProfile } from "@/lib/pending-profile";


interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener BEFORE fetching session
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Re-scope (and purge foreign) client-side customer state before any
      // component can render with the new identity.
      setActiveUser(s?.user?.id ?? null);
      setSession(s);
      setUser(s?.user ?? null);
      // First authenticated session after an email-confirmation signup:
      // apply the address/contact details stashed during signup.
      if (event === "SIGNED_IN" && s?.user) {
        setTimeout(() => {
          completePendingCustomerProfile(s.user).catch(() => {});
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setActiveUser(s?.user?.id ?? null);
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Wipe bag, booking drafts and any other customer-scoped local state.
    setActiveUser(null);
    clearCustomerScopedState(null);
  };


  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
