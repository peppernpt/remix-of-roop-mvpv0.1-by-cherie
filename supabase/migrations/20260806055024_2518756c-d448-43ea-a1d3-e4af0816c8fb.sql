CREATE TABLE public.product_rental_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rental_days integer NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, rental_days)
);

GRANT SELECT ON public.product_rental_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_rental_rates TO authenticated;
GRANT ALL ON public.product_rental_rates TO service_role;

ALTER TABLE public.product_rental_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product rental rates"
  ON public.product_rental_rates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Vendor owner can insert product rental rates"
  ON public.product_rental_rates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_rental_rates.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can update product rental rates"
  ON public.product_rental_rates FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_rental_rates.product_id AND v.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_rental_rates.product_id AND v.owner_id = auth.uid()
  ));

CREATE POLICY "Vendor owner can delete product rental rates"
  ON public.product_rental_rates FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = product_rental_rates.product_id AND v.owner_id = auth.uid()
  ));

CREATE TRIGGER update_product_rental_rates_updated_at
  BEFORE UPDATE ON public.product_rental_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_rental_rates_product ON public.product_rental_rates(product_id);

CREATE OR REPLACE FUNCTION public.enforce_booking_item_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b_start date;
  b_end date;
  days int;
  p_rate numeric;
  p_deposit numeric;
  custom_price numeric;
begin
  select rental_start, rental_end into b_start, b_end
    from public.bookings where id = NEW.booking_id;
  if b_start is null or b_end is null then
    raise exception 'Booking % not found or missing rental dates', NEW.booking_id;
  end if;
  -- Return-date policy: rental_end is the return day and is NOT counted.
  days := greatest(b_end - b_start, 1);

  select daily_rental_rate, coalesce(deposit_amount, 0)
    into p_rate, p_deposit
    from public.products where id = NEW.product_id;
  if p_rate is null then
    raise exception 'Product % not found', NEW.product_id;
  end if;

  select price into custom_price
    from public.product_rental_rates
   where product_id = NEW.product_id and rental_days = days;

  NEW.rental_price := coalesce(custom_price, p_rate * days);
  NEW.deposit_amount := p_deposit;
  return NEW;
end;
$function$;