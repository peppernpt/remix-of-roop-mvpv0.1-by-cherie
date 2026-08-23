import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import RoleToggle from "./RoleToggle";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePostLoginRoute } from "@/lib/post-login";

type Role = "customer" | "vendor";

interface NavbarProps {
  role: Role;
  onRoleChange: (role: Role) => void;
}

const Navbar = ({ role, onRoleChange }: NavbarProps) => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const goToPortal = async () => {
    if (!user) return;
    const dest = await resolvePostLoginRoute(user.id);
    navigate(dest);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl">
      <div className="container-main flex items-center justify-between h-16">
        <span className="text-xl font-bold tracking-tight text-foreground uppercase">
          ROOP
        </span>

        <div className="hidden md:block">
          <RoleToggle role={role} onRoleChange={onRoleChange} />
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-24 h-8" aria-hidden />
          ) : !user ? (
            <>
              <button
                onClick={() =>
                  navigate(
                    role === "vendor"
                      ? "/auth/login?redirect=%2Fvendor%2Fdashboard"
                      : "/auth/login?redirect=%2Fhome"
                  )
                }
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() =>
                  navigate(role === "vendor" ? "/vendor/signup" : "/auth/signup")
                }
                className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                Get Started
              </button>
            </>
          ) : (
            <>
              <button
                onClick={goToPortal}
                aria-label="My account"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
              >
                <span className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </span>
                <span className="hidden sm:inline">My account</span>
              </button>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
