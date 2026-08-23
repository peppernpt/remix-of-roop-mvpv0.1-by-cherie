import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Settings, LogOut, LayoutGrid, Boxes, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BackButton from "@/components/BackButton";

interface Props {
  storeName?: string | null;
  showBack?: boolean;
}

const tabs = [
  { to: "/vendor/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/vendor/transactions", label: "Transactions", icon: Receipt },
  { to: "/vendor/inventory", label: "Inventory", icon: Boxes },
];

const VendorTopBar = ({ storeName, showBack = true }: Props) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="bg-background border-b border-border sticky top-0 z-30">
      <div className="max-w-7xl mx-auto h-16 px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {showBack && <BackButton fallback="/vendor/dashboard" />}
          <Link to="/" className="text-xl font-bold tracking-tight uppercase">ROOP</Link>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active =
                pathname === to ||
                (to === "/vendor/inventory" && pathname.startsWith("/vendor/inventory")) ||
                (to === "/vendor/transactions" && (pathname.startsWith("/vendor/transactions") || pathname.startsWith("/vendor/history")));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <Bell className="w-4 h-4" />
          </button>
          <Link
            to="/vendor/settings"
            aria-label="Edit store profile"
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <Settings className="w-4 h-4" />
          </Link>
          {storeName && (
            <div className="hidden md:block text-right pl-3 border-l border-border">
              <div className="text-sm font-medium leading-tight">{storeName}</div>
              <div className="text-xs text-muted-foreground">Vendor Account</div>
            </div>
          )}
          <button
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default VendorTopBar;
