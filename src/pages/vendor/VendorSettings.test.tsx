import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const vendorRow = {
  id: "v1",
  store_name: "RentCHOM",
  store_category: "Fashion",
  description: "Curated dresses",
  store_address: "456 Fashion Street",
  subdistrict: "Khlong Tan Nuea",
  city: "Bangkok",
  postal_code: "10110",
  logo_url: null,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: vendorRow, error: null }) }),
      }),
    }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, signOut: vi.fn() }),
}));

import VendorSettings from "./VendorSettings";

describe("VendorSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pre-fills the form with the saved vendor row", async () => {
    render(
      <MemoryRouter>
        <VendorSettings />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue("RentCHOM")).toBeTruthy());
    expect(screen.getByDisplayValue("Fashion")).toBeTruthy();
    expect(screen.getByDisplayValue("Curated dresses")).toBeTruthy();
    expect(screen.getByDisplayValue("456 Fashion Street")).toBeTruthy();
    expect(screen.getByDisplayValue("Khlong Tan Nuea")).toBeTruthy();
    expect(screen.getByDisplayValue("Bangkok")).toBeTruthy();
    expect(screen.getByDisplayValue("10110")).toBeTruthy();
  });
});
