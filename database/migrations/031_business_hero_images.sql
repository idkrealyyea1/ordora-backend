-- 031_business_hero_images.sql — multiple hero images per business
--
-- Extends the existing single cover_path with a multi-image carousel.
-- References uploaded_files by path (no duplicate binary storage).

CREATE TABLE IF NOT EXISTS business_hero_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hero_images_position_check CHECK (position >= 0),
  UNIQUE (business_id, position)
);

CREATE INDEX IF NOT EXISTS hero_images_business_idx ON business_hero_images (business_id, position);
CREATE INDEX IF NOT EXISTS hero_images_active_idx ON business_hero_images (business_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS hero_images_one_primary_idx ON business_hero_images (business_id) WHERE is_primary = true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_hero_images INTEGER NOT NULL DEFAULT 6;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_max_hero_images_check') THEN
    ALTER TABLE platform_settings ADD CONSTRAINT platform_max_hero_images_check CHECK (max_hero_images BETWEEN 1 AND 50);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION set_hero_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_hero_images_updated ON business_hero_images;
CREATE TRIGGER trg_hero_images_updated BEFORE UPDATE ON business_hero_images
  FOR EACH ROW EXECUTE FUNCTION set_hero_updated_at();

-- Migrate existing cover_path to hero image records
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT r.id, s.cover_path
    FROM restaurants r
    JOIN restaurant_settings s ON s.restaurant_id = r.id
    WHERE s.cover_path IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM business_hero_images h WHERE h.business_id = r.id
      )
  LOOP
    INSERT INTO business_hero_images (business_id, image_path, position, is_primary, is_active)
    VALUES (rec.id, rec.cover_path, 0, true, true);
  END LOOP;
END
$$;
