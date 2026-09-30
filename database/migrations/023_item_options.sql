-- 023_item_options.sql — product option groups, choices, and order snapshots
--
-- Optional per-product customization (sizes, choices, extras) without
-- disturbing option-free products: products without groups behave exactly
-- as before, joining to empty sets. Snapshots freeze names/prices per
-- order line so definition edits never rewrite history.

CREATE TABLE IF NOT EXISTS option_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_required   BOOLEAN NOT NULL DEFAULT FALSE,
  min_picks     INTEGER NOT NULL DEFAULT 0,
  max_picks     INTEGER NOT NULL DEFAULT 1,
  pricing       TEXT NOT NULL DEFAULT 'adjust',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT option_groups_name_len CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT option_groups_pricing CHECK (pricing IN ('replace', 'adjust')),
  CONSTRAINT option_groups_bounds CHECK (
    max_picks >= 1 AND min_picks >= 0 AND min_picks <= max_picks AND
    ((NOT is_required AND min_picks = 0) OR (is_required AND min_picks >= 1)) AND
    (pricing <> 'replace' OR max_picks = 1)
  ),
  UNIQUE (menu_item_id, name)
);

CREATE INDEX IF NOT EXISTS option_groups_restaurant_idx ON option_groups (restaurant_id);
CREATE INDEX IF NOT EXISTS option_groups_item_idx ON option_groups (menu_item_id, position);

DROP TRIGGER IF EXISTS trg_option_groups_updated ON option_groups;
CREATE TRIGGER trg_option_groups_updated BEFORE UPDATE ON option_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS option_choices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price_cents   INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  max_quantity  INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity BETWEEN 1 AND 99),
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT option_choices_name_len CHECK (char_length(name) BETWEEN 1 AND 60),
  UNIQUE (group_id, name)
);

CREATE INDEX IF NOT EXISTS option_choices_group_idx ON option_choices (group_id, position);
CREATE INDEX IF NOT EXISTS option_choices_restaurant_idx ON option_choices (restaurant_id);

DROP TRIGGER IF EXISTS trg_option_choices_updated ON option_choices;
CREATE TRIGGER trg_option_choices_updated BEFORE UPDATE ON option_choices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS order_item_options (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id    UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  group_id         UUID REFERENCES option_groups(id) ON DELETE SET NULL,
  choice_id        UUID REFERENCES option_choices(id) ON DELETE SET NULL,
  group_name       TEXT NOT NULL,
  choice_name      TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_item_options_line_idx ON order_item_options (order_item_id);
