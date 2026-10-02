-- 032_storefront_language.sql — per-business storefront language
--
-- Allows each business to configure its storefront display language
-- independently from the platform UI language.

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS storefront_language TEXT NOT NULL DEFAULT 'ar';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_storefront_language_check'
  ) THEN
    ALTER TABLE restaurant_settings
      ADD CONSTRAINT settings_storefront_language_check CHECK (storefront_language IN ('ar', 'en'));
  END IF;
END
$$;
