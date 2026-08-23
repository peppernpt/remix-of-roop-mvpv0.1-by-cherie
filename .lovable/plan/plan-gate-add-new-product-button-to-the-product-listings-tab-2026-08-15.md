# Plan: Gate "Add New Product" button to the Product Listings tab

## Goal
On the Vendor Inventory page (`src/pages/vendor/VendorInventory.tsx`), show the "Add New Product" button only when the **Product Listings** tab is active, and hide it on the **Individual Items** tab. No other behavior changes.

## Current state (verified)
- The page header (title + "Add New Product" button) lives at lines 425–433, **outside** the `<Tabs>` component.
- The `<Tabs>` component at line 435 is **uncontrolled** (`defaultValue="inventory"`), so there is no state tracking the active tab.
- Tab values: `"inventory"` (Individual Items) and `"listings"` (Product Listings).
- The button navigates to `/vendor/inventory/new` — this must not change.

## Changes (single file: `src/pages/vendor/VendorInventory.tsx`)

1. **Add controlled tab state**
   - Add `const [activeTab, setActiveTab] = useState<string>("inventory");` near the other state declarations (around line 147).

2. **Make the Tabs controlled**
   - On the `<Tabs>` element (line 435), replace `defaultValue="inventory"` with `value={activeTab} onValueChange={setActiveTab}`.

3. **Conditionally render the "Add New Product" button**
   - In the header (lines 425–433), wrap the `<Button>` so it only renders when `activeTab === "listings"`.
   - To keep the header visually balanced (avoid the title snapping to the right edge), render an empty placeholder `<div className="hidden md:block" />` of equal footprint when the button is hidden — keeps `justify-between` spacing stable.

Resulting header:
```tsx
<div className="flex items-end justify-between gap-4 flex-wrap">
  <div>
    <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
    <p className="text-sm text-muted-foreground mt-1">Manage your rental products and availability</p>
  </div>
  {activeTab === "listings" ? (
    <Button onClick={() => navigate("/vendor/inventory/new")}>
      <Plus className="w-4 h-4" /> Add New Product
    </Button>
  ) : (
    <div className="hidden md:block w-[160px]" aria-hidden />
  )}
</div>
```

## What does NOT change
- The Add New Product flow / routing / form.
- Individual Items table, Product Listings table, subtabs, search/filter.
- Inventory counts and status pills.
- All booking/unit data fetching and logic.

## QA checks (manual, via preview)
- A: Inventory → Individual Items → "Add New Product" is **not visible**.
- B: Switch to Product Listings → "Add New Product" appears top-right.
- C: Click it → still navigates to the add product page.
- D: Switch back and forth → button visibility updates every time.
