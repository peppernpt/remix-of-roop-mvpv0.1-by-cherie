import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import OrderRequestSent from "./OrderRequestSent";

const currentUser = { id: "customer-123", email: "test@example.com" };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, loading: false, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/** Rows returned per table; `bookings` respects the customer_id filter. */
const tableRows: Record<string, any> = {
  bookings: { id: "b1", vendor_id: null, customer_id: "customer-123" },
  booking_items: null,
  vendors: null,
};

const makeQuery = (table: string) => {
  const filters: Record<string, unknown> = {};
  const chain: any = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return chain;
    },
    limit: () => chain,
    maybeSingle: () => {
      const row = tableRows[table];
      if (row && Object.entries(filters).some(([k, v]) => k !== "id" && k in row && row[k] !== v)) {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: row, error: null });
    },
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn((table: string) => makeQuery(table)),
  },
}));


const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(""),
};

Object.defineProperty(navigator, "clipboard", {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

const Wrapper = ({ initialPath }: { initialPath: string }) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="/order-sent/:id" element={<OrderRequestSent />} />
    </Routes>
  </MemoryRouter>
);

describe("OrderRequestSent LINE instructions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableRows.bookings = { id: "b1", vendor_id: null, customer_id: "customer-123" };
  });

  it("hides another user's request confirmation", async () => {
    tableRows.bookings = { id: "b1", vendor_id: null, customer_id: "other-user-999" };
    render(<Wrapper initialPath="/order-sent/abc-1234" />);

    await waitFor(() => {
      expect(screen.getByText("Request not found")).toBeInTheDocument();
    });
    expect(screen.queryByText("Next step: Message the store on LINE")).not.toBeInTheDocument();
  });


  it("renders the LINE instruction section and generated message with reference", () => {
    render(<Wrapper initialPath="/order-sent/test-ref-1234" />);

    expect(screen.getByText("Next step: Message the store on LINE")).toBeInTheDocument();
    expect(screen.getByText(/Hi, I requested an item from ROOP\. My booking reference is #TEST-R/)).toBeInTheDocument();
  });

  it("copies the generated message to clipboard and shows feedback", async () => {
    render(<Wrapper initialPath="/order-sent/abc-1234" />);

    const copyButton = screen.getByRole("button", { name: /copy message/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "Hi, I requested an item from ROOP. My booking reference is #ABC-12."
      );
    });
    expect(screen.getByText("Message copied.")).toBeInTheDocument();
  });

  it("keeps the Go to tracking button", () => {
    render(<Wrapper initialPath="/order-sent/xyz-9999" />);

    expect(screen.getByRole("link", { name: /go to tracking/i })).toHaveAttribute("href", "/tracking");
    expect(screen.queryByRole("link", { name: /continue browsing/i })).not.toBeInTheDocument();
  });
});
