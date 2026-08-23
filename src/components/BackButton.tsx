import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Override the default fallback route when there's no history to go back to. */
  fallback?: string;
  className?: string;
  label?: string;
}

/**
 * Universal Back navigation.
 * - Uses browser history when possible (preserves form state, no refresh).
 * - Falls back to a sensible route based on current path when history is empty.
 */
const BackButton = ({ fallback, className, label = "Back" }: BackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const resolveFallback = () => {
    if (fallback) return fallback;
    const p = location.pathname;
    if (p === "/vendor/signup" || p === "/vendor/signup-step-1") return "/";
    if (p.startsWith("/vendor")) return "/vendor/dashboard";
    if (p.startsWith("/booking")) return "/explore";
    return "/explore";
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // history.state.idx is set by react-router; >0 means we have a previous entry within this SPA session.
    const idx = (window.history.state && (window.history.state as any).idx) ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      navigate(resolveFallback(), { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 -ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
