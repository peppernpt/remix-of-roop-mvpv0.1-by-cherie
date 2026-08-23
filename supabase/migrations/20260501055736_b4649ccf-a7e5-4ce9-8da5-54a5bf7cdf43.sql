-- Extend products with new fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS min_rental_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_rental_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER,
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS specifications TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'draft';

-- Sanity: keep publish_status in sync with is_active for any existing rows
UPDATE public.products
   SET publish_status = CASE WHEN is_active THEN 'published' ELSE 'draft' END
 WHERE publish_status IS NULL OR publish_status NOT IN ('draft','published');

-- Constrain rental day ranges via trigger (CHECK is fine here but trigger is more flexible)
CREATE OR REPLACE FUNCTION public.validate_product_rental_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.min_rental_days < 1 THEN
    RAISE EXCEPTION 'min_rental_days must be >= 1';
  END IF;
  IF NEW.max_rental_days < NEW.min_rental_days THEN
    RAISE EXCEPTION 'max_rental_days must be >= min_rental_days';
  END IF;
  IF NEW.publish_status NOT IN ('draft','published') THEN
    RAISE EXCEPTION 'publish_status must be draft or published';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_rental_days_trg ON public.products;
CREATE TRIGGER validate_product_rental_days_trg
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_product_rental_days();

-- Add condition to product_units
ALTER TABLE public.product_units
  ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'Excellent';
