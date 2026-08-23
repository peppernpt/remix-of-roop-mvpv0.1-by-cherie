import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Explore from "./pages/Explore.tsx";
import Booking from "./pages/Booking.tsx";
import Auth from "./pages/Auth.tsx";
import VendorSignup from "./pages/VendorSignup.tsx";
import VendorEntry from "./pages/VendorEntry.tsx";
import VendorDashboard from "./pages/VendorDashboard.tsx";
import VendorInventory from "./pages/vendor/VendorInventory.tsx";
import VendorProductForm from "./pages/vendor/VendorProductForm.tsx";
import VendorTransactions from "./pages/vendor/VendorTransactions.tsx";
import VendorHistory from "./pages/vendor/VendorHistory.tsx";
import VendorSettings from "./pages/vendor/VendorSettings.tsx";
import Bag from "./pages/customer/Bag.tsx";
import OrderRequestSent from "./pages/customer/OrderRequestSent.tsx";
import PaymentReceived from "./pages/customer/PaymentReceived.tsx";
import PaymentSlip from "./pages/customer/PaymentSlip.tsx";
import CustomerHome from "./pages/customer/CustomerHome.tsx";
import Tracking from "./pages/customer/Tracking.tsx";
import History from "./pages/customer/History.tsx";
import Profile from "./pages/customer/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";
import RoleGuard from "./components/RoleGuard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/booking/:id" element={<Booking />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/login" element={<Auth />} />
            <Route path="/auth/signup" element={<Auth />} />
            <Route path="/vendor/signup" element={<VendorSignup />} />
            <Route path="/vendor/signup-step-1" element={<VendorEntry />} />
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
            <Route path="/order-sent/:id" element={<OrderRequestSent />} />
            <Route path="/payment-received/:id" element={<PaymentReceived />} />
            <Route path="/booking-payment/:id" element={<RoleGuard allow="customer"><PaymentSlip /></RoleGuard>} />
            <Route path="/tracking" element={<RoleGuard allow="customer"><Tracking /></RoleGuard>} />
            <Route path="/history" element={<RoleGuard allow="customer"><History /></RoleGuard>} />
            <Route path="/profile" element={<RoleGuard allow="customer"><Profile /></RoleGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
