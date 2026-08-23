# Move Delivery Tracking below Payment Summary

## Current state
In `src/components/vendor/OrderDetailDialog.tsx`, the Delivery Tracking section currently appears right after the Delivery Details section (lines ~574-595). The Payment Summary section follows later (lines ~771-802), and Payment Slip comes after it (lines ~807-838).

## Goal
Reorder the vendor order detail modal so Delivery Tracking appears after Payment Summary and before Payment Slip, without changing any logic for how tracking links are saved, stored, or displayed.

## Required layout
1. Customer Information
2. Delivery Details
3. Ordered Items
4. Rental Schedule
5. Delivery Fee
6. Promo Code (if applicable)
7. Payment Summary
8. Delivery Tracking
9. Payment Slip
10. Bottom action buttons

## Implementation
- Move the "Delivery Tracking" `<Section>` block in `src/components/vendor/OrderDetailDialog.tsx` from after "Delivery Details" to after "Payment Summary" and before "Payment Slip".
- Keep the exact section title, input label, placeholder, helper text, and Save Tracking Link button.
- Keep the existing `saveTrackingUrl` handler and `trackingUrl` state unchanged.

## Verification
- Open the vendor order detail modal and confirm the Delivery Tracking section appears directly below Payment Summary.
- Confirm that saving a tracking link still works, persists after refresh, and shows on the customer Tracking page.
- Confirm that payment slip preview and all other modal sections remain unchanged.
