# Remove sensitive identity, tax, and banking collection

Cherie MVP will stop collecting Citizen ID, ID documents, vendor Tax ID, and vendor Bank Account. Columns stay in the database (all already optional), the app simply stops writing, reading, and showing them.

## Customer signup (Step 2)

- Rename the step to "Delivery Information" with the copy "Add your delivery information so stores can prepare your rental request."
- Remove the Citizen ID field and the ID card/passport upload (no banking field exists here).
- Step 2 keeps: address label, address line 1, address line 2 (optional), city, postcode, terms checkbox, complete signup button.
- Drop Citizen ID / document rules from the validation schema so signup succeeds with account info + address + terms.
- Remove the ID document storage upload and the customer_verifications insert from the signup submit.

## Customer profile

- Remove the whole Identity verification card: masked Citizen ID, document status, upload control, and the edit/save flow.
- Keep personal information, delivery address, and account actions exactly as they are.
- Delete the now-unused verification helper module and its test.

## Vendor signup (Store Information)

- Remove the Tax ID / Business Reg. and Bank Account Number fields, their state, validation, and the values sent when the vendor row is created.
- Keep store name, category, description, address, subdistrict, city, postal code, LINE ID, Instagram, and logo.

## Vendor settings / Edit Store Profile

- Remove the Tax ID and Bank Account Number inputs, their state, the required-bank-account validation, the fetch, and the update payload.
- Keep all remaining store fields editable and saving as today.
- Update the settings test so it no longer asserts on tax ID / bank account values.

## Database

No schema migration is needed: `vendors.tax_id`, `vendors.bank_account`, and `customer_verifications.id_number` are already nullable, so nothing can block signup. Columns are left in place.

Optional cleanup (only if you want it): blank out existing test values — vendor tax IDs and bank accounts, and customer verification ID numbers/documents. No accounts are deleted. Say the word and I'll include it.

## Untouched

Booking, pricing/date, delivery fee, promo/discount/deposit, calendar availability, inventory, payment slip, and vendor transaction logic stay as-is. The payment slip page currently displays the vendor's bank account when present; it already falls back to "Vendor will share payment instructions via chat", which becomes the default now that the field is no longer collected.

## Technical notes

Files touched: `src/pages/Auth.tsx`, `src/pages/customer/Profile.tsx`, `src/pages/VendorSignup.tsx`, `src/pages/vendor/VendorSettings.tsx`, `src/pages/vendor/VendorSettings.test.tsx`; delete `src/lib/verification.ts` and `src/lib/verification.test.ts`. Verified with a typecheck and the existing test suite.
