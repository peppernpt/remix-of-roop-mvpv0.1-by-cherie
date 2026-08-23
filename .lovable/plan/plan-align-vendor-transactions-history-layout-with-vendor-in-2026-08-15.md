# Plan: Align Vendor Transactions & History layout with Vendor Inventory

## Overview

Restyle the Vendor Transactions and Vendor History pages so their layout, spacing,
tab styling, card structure, and table formatting match the Vendor Inventory page.
No booking/payment/pricing/filtering logic changes — this is a presentation-only
refactor of the two pages `src/pages/vendor/VendorTransactions.tsx` and
`src/pages/vendor/VendorHistory.tsx`.

## Reference (Inventory page) — the patterns to copy

Header:
- `<main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">`
- Title `<h1 className="text-3xl font-semibold tracking-tight">`
- Subtitle `<p className="text-sm text-muted-foreground mt-1">`
- `showBack` omitted on `<VendorTopBar>` (Inventory uses default)

Segmented top tabs:
- `<Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger .../></TabsList>`
- Default shadcn segmented control — NO `bg-transparent border-b rounded-none` overrides
- Two triggers: Transactions | History

Card container (wraps pills + search + table):
- `<div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">`

Status pills (inside card, top):
- `flex items-center gap-1.5 flex-wrap mb-4`
- Each pill: `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border`
- Active: `bg-foreground text-background border-foreground`
- Inactive: `bg-background text-muted-foreground border-border hover:text-foreground`
- Count badge: `text-[10px] px-1.5 py-0.5 rounded-full`, active `bg-background/20`, else `bg-muted`

Search (inside card, below pills):
- `<div className="relative max-w-md mb-4">` with `Search` icon + `Input` `pl-9`

Table (inside card, below search):
- `<div className="overflow-x-auto"><table className="w-full text-sm">`
- `<thead className="text-xs uppercase text-muted-foreground tracking-wide">`
- `<tr className="border-b border-border">`, `<th className="text-left font-medium py-3 px-3">`
- Rows: `border-b border-border/60 hover:bg-muted/40`, cells `py-3 px-3`
- View action: `<Button variant="ghost" size="sm" className="h-8">`

## Changes per file

### 1. `src/pages/vendor/VendorTransactions.tsx` (Transactions tab — active orders)

- Replace the standalone header band (`bg-background border-b ... max-w-6xl py-5`) with the
  Inventory header pattern (`max-w-7xl ... py-8`, `text-3xl` title, `mt-1` subtitle).
- Replace the underline-style Transactions/History `TabsList` with the default segmented
  `<TabsList>`. Bind `value` to `"transactions"` and `onValueChange` → navigate to
  `/vendor/history` when History is selected (keep two routes; segmented control acts as nav).
- Move the status pill row and search bar INSIDE the card
  (`bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm`), matching Inventory's
  pill → search → table order.
- Keep the existing pill set and counts: View All, Pending Request, Waiting Payment,
  Payment Submitted, To Deliver, On Delivery, On Rent, On Return, For Review.
  Restyle `PillTab` to the Inventory pill classes above (currently close — align exactly).
- Restyle the table: drop the `bg-muted/30` thead and `px-4 py-3` `Th`/`Td` helpers; use the
  Inventory `text-xs uppercase` thead and `py-3 px-3` cells, `border-b border-border/60 hover:bg-muted/40` rows.
  Keep columns: Customer, Order ID, Items, Dates, Status, Value, Actions.
- Keep the disabled Filter button next to search (move it inside the card row).
- Loading/empty states use `py-12 text-center text-muted-foreground` like Inventory.
- All filtering/counts/status logic (`CLOSED_STATUSES`, `matchesTab`, `isForReview`) unchanged.

### 2. `src/pages/vendor/VendorHistory.tsx` (History tab — closed orders)

- Apply the identical header, segmented top-tabs (value `"history"`, onValueChange → navigate
  to `/vendor/transactions`), and card structure.
- Move the All/Completed/Cancelled/Rejected filter row and search INSIDE the card, restyled as
  Inventory pills (selected = `bg-foreground text-background`). Keep four filters incl. Rejected.
- Restyle the table to match Inventory (same thead/cell/row classes).
- Keep columns: Customer, Order ID, Items, Dates, Status, Value, Actions.
- History filtering logic (`completed | cancelled | rejected`) unchanged.

## What stays unchanged

- Booking status values, workflow transitions, payment/pricing/promo/tracking/return-review logic.
- Transactions = active statuses only; History = completed/cancelled/rejected; For Review stays in Transactions.
- Route paths `/vendor/transactions` and `/vendor/history` (segmented control navigates between them).
- `OrderDetailDialog` wiring, `useVendorBookings`, `replaceBooking`, all modal interactions.

## Files touched

- `src/pages/vendor/VendorTransactions.tsx`
- `src/pages/vendor/VendorHistory.tsx`

## Verification

- `npx tsgo --noEmit -p tsconfig.app.json` passes.
- Browser: Vendor → Transactions — header/segmented tabs/card/pills/table match Inventory;
  switching to History keeps layout consistent; View opens the order modal; counts and search work.
