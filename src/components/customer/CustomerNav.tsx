import { NavLink, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Calendar, History, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Rent", icon: ShoppingBag },
  { to: "/tracking", label: "Tracking", icon: Calendar },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: User },
];

const CustomerNav = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
      <div className="container-main flex items-center justify-between h-16 gap-4">
        <NavLink to="/home" className="text-xl font-bold tracking-tight uppercase">
          ROOP
        </NavLink>

        <nav className="hidden md:flex items-center gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

    </header>
  );
};

/**
 * Thumb-reachable bottom tab bar on mobile. Fixed to the viewport bottom
 * (with safe-area padding for gesture-nav phones) instead of a second header
 * row. Pair with `pb-20 md:pb-0` on the page container.
 */
export const CustomerBottomNav = () => (
  <nav
    className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl flex items-stretch justify-around"
    style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    aria-label="Primary"
  >
    {items.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 h-14 text-[10px] font-medium",
            isActive ? "text-foreground" : "text-muted-foreground"
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                "flex items-center justify-center w-9 h-6 rounded-full transition-colors",
                isActive && "bg-foreground text-background"
              )}
            >
              <Icon className="w-4 h-4" />
            </span>
            {label}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

export default CustomerNav;
