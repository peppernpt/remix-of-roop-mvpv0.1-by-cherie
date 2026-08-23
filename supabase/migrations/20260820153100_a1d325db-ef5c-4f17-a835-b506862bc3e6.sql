DO $$
DECLARE
  orig uuid := '0a43f49a-97a1-452a-a8a7-c7eeb48a03a4';
  dup  uuid := '55120241-0c59-4bfa-9136-60165d2397df';
  n int;
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.booking_items WHERE product_id = dup) THEN
    RAISE EXCEPTION 'duplicate product has booking history; manual cleanup required';
  END IF;

  SELECT COALESCE(MAX((regexp_replace(serial_id, '^.*-', ''))::int), 0)
    INTO n FROM public.product_units
   WHERE product_id = orig AND serial_id ~ '-[0-9]+$';

  FOR r IN SELECT id FROM public.product_units WHERE product_id = dup ORDER BY serial_id LOOP
    n := n + 1;
    UPDATE public.product_units
       SET product_id = orig,
           serial_id = 'CAL-BALMINI-BLK-M-' || lpad(n::text, 3, '0')
     WHERE id = r.id;
  END LOOP;

  DELETE FROM public.product_images WHERE product_id = dup;
  DELETE FROM public.product_rental_rates WHERE product_id = dup;
  DELETE FROM public.products WHERE id = dup;
END $$;