import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Bag from "./Bag";
import * as bagStore from "@/lib/bag-store";

const mockBagItems = [
  {
    id: "bag-item-1",
    productId: "product-1",
    productName: "Silk Dress",
    productImage: "https://example.com/dress.jpg",
    vendorId: "vendor-1",
    vendorName: "Silk Boutique",
    size: "M",
    color: "Red",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    days: 3,
    deliveryMethod: "delivery",
    province: "Bangkok",
    address: "123 Main St",
    rentalTotal: 3000,
    depositTotal: 1500,
  },
];

const { mockFrom, mockInsert, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "customer-123", email: "customer@example.com" },
    loading: false,
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/bag-store", async () => {
  const actual = await vi.importActual<typeof bagStore>("@/lib/bag-store");
  return {
    ...actual,
    readBag: vi.fn(),
    removeFromBag: vi.fn(),
    clearBag: vi.fn(),
  };
});

vi.mock("@/components/customer/CustomerLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="customer-layout">{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="page-hero">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

const Wrapper = () => (
  <MemoryRouter initialEntries={["/bag"]}>
    <Routes>
      <Route path="/bag" element={<Bag />} />
      <Route path="/order-sent/:id" element={<div data-testid="order-sent">Order Sent</div>} />
    </Routes>
  </MemoryRouter>
);

describe("Bag Request Policy acknowledgement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: [], error: null });
    (bagStore.readBag as ReturnType<typeof vi.fn>).mockReturnValue(mockBagItems);
    (bagStore.removeFromBag as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (bagStore.clearBag as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "customer-123" }, error: null }),
            }),
          }),
          upsert: () => ({ error: null }),
        };
      }
      if (table === "vendors_public") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "vendor-1", is_active: true }, error: null }),
            }),
          }),
        };
      }
      if (table === "product_units" || table === "product_units_public") {
        const unitQuery: any = {
          eq: () => unitQuery,
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "unit-1" }, error: null }),
          }),
          then: (resolve: any) => resolve({ data: [{ id: "unit-1" }], error: null }),
        };
        return {
          select: () => unitQuery,
          update: () => ({ eq: () => ({ error: null }) }),
        };
      }
      if (table === "bookings") {
        return {
          insert: (payload: unknown) => {
            mockInsert(payload);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: "booking-123" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "booking_items") {
        return {
          insert: () => ({ error: null }),
        };
      }
      return {};
    });
  });

  it("renders the acknowledgement checkbox and View request policy link", () => {
    render(<Wrapper />);

    expect(screen.getByText("I understand and agree to ROOP’s request policy.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View request policy" })).toBeInTheDocument();
  });

  it("opens the Request Policy modal when View request policy is clicked", () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByRole("button", { name: "View request policy" }));

    expect(screen.getByRole("dialog", { name: "Request Policy" })).toBeInTheDocument();
    expect(screen.getByText("For this MVP test, ROOP does not automatically process item changes, cancellations, or refunds.")).toBeInTheDocument();
  });

  it("closes the modal when I understand is clicked and does not tick the checkbox", () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByRole("button", { name: "View request policy" }));
    expect(screen.getByRole("dialog", { name: "Request Policy" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(screen.queryByRole("dialog", { name: "Request Policy" })).not.toBeInTheDocument();
    const checkbox = screen.getByLabelText(/request policy/i) as HTMLInputElement;
    const returnCheckbox = screen.getByLabelText(/responsible for returning/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("disables Send order request when the checkbox is not ticked", () => {
    render(<Wrapper />);

    const submitButton = screen.getByRole("button", { name: "Send order request" });
    expect(submitButton).toBeDisabled();
  });

  it("enables Send order request when the checkbox is ticked and creates a booking with policy data", async () => {
    render(<Wrapper />);

    const checkbox = screen.getByLabelText(/request policy/i) as HTMLInputElement;
    const returnCheckbox = screen.getByLabelText(/responsible for returning/i) as HTMLInputElement;
    fireEvent.click(checkbox);
    fireEvent.click(returnCheckbox);
    expect(checkbox.checked).toBe(true);

    const submitButton = screen.getByRole("button", { name: "Send order request" });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });

    const bookingInsert = mockInsert.mock.calls.find(
      (call) => (call[0] as { status: string }).status === "pending_vendor_review"
    )?.[0] as { policy_acknowledged: boolean; policy_acknowledged_at: string };
    expect(bookingInsert).toMatchObject({
      policy_acknowledged: true,
    });
    expect(bookingInsert.policy_acknowledged_at).toBeTruthy();
    expect(screen.getByTestId("order-sent")).toBeInTheDocument();
  });

  it("blocks submission when the checkbox is not ticked and keeps the guard disabled", async () => {
    render(<Wrapper />);

    const submitButton = screen.getByRole("button", { name: "Send order request" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByLabelText(/request policy/i)).not.toBeChecked();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("passes the promo code through to the booking insert", async () => {
    render(<Wrapper />);

    const promoInput = screen.getByPlaceholderText("Enter promo code");
    fireEvent.change(promoInput, { target: { value: "ROOP10" } });

    const checkbox = screen.getByLabelText(/request policy/i) as HTMLInputElement;
    const returnCheckbox = screen.getByLabelText(/responsible for returning/i) as HTMLInputElement;
    fireEvent.click(checkbox);
    fireEvent.click(returnCheckbox);

    fireEvent.click(screen.getByRole("button", { name: "Send order request" }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });

    const bookingInsert = mockInsert.mock.calls.find(
      (call) => (call[0] as { promo_code: string }).promo_code === "ROOP10"
    )?.[0] as { promo_code: string };
    expect(bookingInsert).toMatchObject({
      promo_code: "ROOP10",
    });
  });
});
