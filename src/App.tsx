import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import RoleGuard from "./components/RoleGuard.tsx";
import Index from "./pages/Index.tsx";

// Route-level code splitting: the landing page loads eagerly, everything else
// loads on navigation. Keeps the first paint small on mobile connections.
const Explore = lazy(() => import("./pages/Explore.tsx"));
const Booking = lazy(() => import("./pages/Booking.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword.tsx"));
const VendorSignup = lazy(() => import("./pages/VendorSignup.tsx"));
const VendorEntry = lazy(() => import("./pages/VendorEntry.tsx"));
const StoreSetup = lazy(() => import("./pages/vendor/StoreSetup.tsx"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard.tsx"));
const VendorInventory = lazy(() => import("./pages/vendor/VendorInventory.tsx"));
const VendorProductForm = lazy(() => import("./pages/vendor/VendorProductForm.tsx"));
const VendorTransactions = lazy(() => import("./pages/vendor/VendorTransactions.tsx"));
const VendorHistory = lazy(() => import("./pages/vendor/VendorHistory.tsx"));
const VendorSettings = lazy(() => import("./pages/vendor/VendorSettings.tsx"));
const Bag = lazy(() => import("./pages/customer/Bag.tsx"));
const OrderRequestSent = lazy(() => import("./pages/customer/OrderRequestSent.tsx"));
const PaymentReceived = lazy(() => import("./pages/customer/PaymentReceived.tsx"));
const PaymentSlip = lazy(() => import("./pages/customer/PaymentSlip.tsx"));
const CustomerHome = lazy(() => import("./pages/customer/CustomerHome.tsx"));
const Tracking = lazy(() => import("./pages/customer/Tracking.tsx"));
const History = lazy(() => import("./pages/customer/History.tsx"));
const Profile = lazy(() => import("./pages/customer/Profile.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

/** Start each navigation at the top of the page instead of mid-scroll. */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ScrollToTop />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/booking/:id" element={<Booking />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/login" element={<Auth />} />
                <Route path="/auth/signup" element={<Auth />} />
                <Route path="/auth/reset" element={<ResetPassword />} />
                <Route path="/vendor/signup" element={<VendorSignup />} />
                <Route path="/vendor/signup-step-1" element={<VendorEntry />} />
                <Route path="/vendor/setup" element={<StoreSetup />} />
                <Route path="/vendor/dashboard" element={<RoleGuard allow="vendor"><VendorDashboard /></RoleGuard>} />
                <Route path="/vendor/inventory" element={<RoleGuard allow="vendor"><VendorInventory /></RoleGuard>} />
                <Route path="/vendor/inventory/new" element={<RoleGuard allow="vendor"><VendorProductForm mode="create" /></RoleGuard>} />
                <Route path="/vendor/inventory/:id/edit" element={<RoleGuard allow="vendor"><VendorProductForm mode="edit" /></RoleGuard>} />
                <Route path="/vendor/transactions" element={<RoleGuard allow="vendor"><VendorTransactions /></RoleGuard>} />
                <Route path="/vendor/settings" element={<RoleGuard allow="vendor"><VendorSettings /></RoleGuard>} />
                <Route path="/vendor/history" element={<RoleGuard allow="vendor"><VendorHistory /></RoleGuard>} />
                {/* Customer portal */}
                <Route path="/home" element={<RoleGuard allow="customer"><CustomerHome /></RoleGuard>} />
                <Route path="/bag" element={<RoleGuard allow="customer"><Bag /></RoleGuard>} />
                <Route path="/order-sent/:id" element={<RoleGuard allow="customer"><OrderRequestSent /></RoleGuard>} />
                <Route path="/payment-received/:id" element={<RoleGuard allow="customer"><PaymentReceived /></RoleGuard>} />
                <Route path="/booking-payment/:id" element={<RoleGuard allow="customer"><PaymentSlip /></RoleGuard>} />
                <Route path="/tracking" element={<RoleGuard allow="customer"><Tracking /></RoleGuard>} />
                <Route path="/history" element={<RoleGuard allow="customer"><History /></RoleGuard>} />
                <Route path="/profile" element={<RoleGuard allow="customer"><Profile /></RoleGuard>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
