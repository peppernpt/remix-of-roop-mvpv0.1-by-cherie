import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import CustomerNav, { CustomerBottomNav } from "./CustomerNav";

interface Props {
  children: ReactNode;
  /** Optional hero/title block rendered just under the nav. */
  hero?: ReactNode;
  /** When true, don't redirect unauthenticated users (used for confirmation pages). */
  allowAnonymous?: boolean;
}

const CustomerLayout = ({ children, hero, allowAnonymous = false }: Props) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !allowAnonymous) {
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(window.location.pathname)}`, {
        replace: true,
      });
    }
  }, [user, loading, allowAnonymous, navigate]);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-16 md:pb-0">
      <CustomerNav />
      {hero}
      <main className="flex-1 container-main py-8 md:py-10">{children}</main>
      <CustomerBottomNav />
    </div>
  );
};

export const PageHero = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <div className="bg-foreground text-background">
    <div className="container-main py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-medium tracking-tight">{title}</h1>
      {subtitle && (
        <p className="text-sm md:text-base text-background/70 mt-1">{subtitle}</p>
      )}
    </div>
  </div>
);

export default CustomerLayout;
