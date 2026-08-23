
-- Revoke public/anon/authenticated EXECUTE from all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.vendor_owner_has_booking_with_customer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.customer_has_booking_with_vendor(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_vendor_owner(uuid, uuid) FROM PUBLIC, anon;

-- Trigger-only functions: revoke from everyone except owner/service_role
REVOKE EXECUTE ON FUNCTION public.enforce_booking_item_pricing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_booking_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_booking_totals_items() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_booking_totals_defaults() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_booking_totals_self() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS helper functions still need to be callable within policies by signed-in users
GRANT EXECUTE ON FUNCTION public.vendor_owner_has_booking_with_customer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_has_booking_with_vendor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_vendor_owner(uuid, uuid) TO authenticated;
