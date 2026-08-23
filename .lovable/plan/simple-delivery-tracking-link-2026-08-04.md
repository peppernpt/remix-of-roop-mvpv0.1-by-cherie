# Simple delivery tracking link

Vendors paste a tracking link on an order; the owning customer can open it from their Tracking page. No courier APIs, no notifications, no status/pricing/calendar changes.

## Database

Add two nullable columns to `bookings` (no new table):
- `delivery_tracking_url` (text)
- `delivery_tracking_updated_at` (timestamptz)

Existing access rules already cover this: vendors can update only their own store's bookings, customers can read only their own. No new policies needed.

## Vendor side

In the vendor order detail modal, add a "Delivery Tracking" section placed right after Delivery Details:
- Text input, placeholder "Paste delivery tracking link here"
- Helper text: "This link will be shown to the customer on their Tracking page."
- "Save Tracking Link" button

Save behavior:
- Empty value clears the link (allowed)
- Non-empty must start with `http://` or `https://`, otherwise show "Please enter a valid tracking link." and don't save
- On save, store the URL and set the updated timestamp; the field stays editable
- Nothing else in the order is blocked by this field

Visibility: shown on all non-cancelled/non-rejected orders (simplest and safe), never required.

## Customer side

In the existing read-only customer order detail modal (opened from Tracking and History), add a "Delivery Tracking" section:
- If a link exists: "Open tracking link" anchor with `target="_blank"` and `rel="noopener noreferrer"`
- If not: "Tracking link not added yet."
- Read-only, no editing

Also surface the same "Open tracking link" action on the Tracking card for active orders that have a link, so it's reachable without opening the modal.

The customer query stays filtered to the signed-in user, so a link is only ever loaded for that user's own bookings.

## Verification

- Vendor: open a To Deliver / On Delivery order, paste a link, save, reload — link persists.
- Vendor: invalid text shows the validation message and saves nothing; empty value clears the link.
- Customer: modal and card show the link and open it in a new tab; with no link the "not added yet" message shows and nothing crashes.
- Confirm status transitions, payment summary, and calendar blocking are untouched.

Note: this project uses an external Supabase, so a signed-in two-user browser check can't be run here; cross-user isolation relies on the existing per-user query scoping and database access rules.
