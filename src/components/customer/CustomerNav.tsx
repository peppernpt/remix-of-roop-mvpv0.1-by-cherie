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

      {/* Mobile bottom nav */}
      <nav className="md:hidden border-t border-border bg-background flex items-center justify-around h-14">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px]",
                isActive ? "text-foreground" : "text-muted-foreground"
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

export default CustomerNav;
