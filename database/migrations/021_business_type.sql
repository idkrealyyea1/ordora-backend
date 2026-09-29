-- 021_business_type.sql — shared Food Business type (closed set, default restaurant)
--
-- One shared tenant model for restaurants, cafes, dessert shops, bakeries,
-- cake businesses, home kitchens, home food businesses, cloud kitchens, and
-- small food businesses. Type is data on the tenant root, not separate apps.
-- DEFAULT 'restaurant' preserves existing behavior for all current rows with
-- zero backfill. No index: no query filters by type in this feature.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'restaurant';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_business_type_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_business_type_check CHECK (
        business_type IN (
          'restaurant', 'cafe', 'dessert_shop', 'bakery', 'cake_business',
          'home_kitchen', 'home_food_business', 'cloud_kitchen', 'small_food_business'
        )
      );
  END IF;
END
$$;
