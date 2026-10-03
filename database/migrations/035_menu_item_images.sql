-- 035_menu_item_images.sql — ordered additional photo set per menu item.
--
-- ADDITIVE ONLY. `menu_items.image_path` remains the authoritative primary image
-- and is not duplicated, moved or altered here, so every existing consumer
-- (menu.service, restaurants.service, the storefront, the type=items upload
-- replace path) keeps working unchanged.
--
-- The public payload merges them as: images[0] === image_path, then this set.
-- An item with no rows here behaves exactly as it does today.
--
-- No backfill: existing businesses need no data migration and no configuration.

CREATE TABLE IF NOT EXISTS menu_item_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  image_path    TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_images_position_check CHECK (position >= 0),
  CONSTRAINT menu_item_images_position_unique UNIQUE (menu_item_id, position)
);

-- Ordered read for the public menu join.
CREATE INDEX IF NOT EXISTS menu_item_images_item_idx
  ON menu_item_images (menu_item_id, position);

-- Tenant-scoped listing and isolation checks.
CREATE INDEX IF NOT EXISTS menu_item_images_restaurant_idx
  ON menu_item_images (restaurant_id);

-- Reuse the existing updated_at trigger helper (set_updated_at from 001_init.sql).
DROP TRIGGER IF EXISTS trg_menu_item_images_updated ON menu_item_images;
CREATE TRIGGER trg_menu_item_images_updated
  BEFORE UPDATE ON menu_item_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();