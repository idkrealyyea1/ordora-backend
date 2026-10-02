-- 028_plans.sql — data-driven SaaS plans + plan-to-capability mapping
--
-- Additive only. Seeds exactly one plan (`standard`) mirroring the platform
-- price in platform_settings at migration time (never hard-coded here).
-- Plan limits seed as NULL (inherit the business row value), so no existing
-- business changes effective limits on migration day. Re-runs as no-op.

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  period TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month', 'year')),
  trial_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_entitlements (
  plan_id UUID NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  limit_value INTEGER NULL CHECK (limit_value IS NULL OR limit_value >= 0),
  PRIMARY KEY (plan_id, capability_key)
);

-- Seed the single initial plan from the platform price (Task 14: one plan).
DO $$
DECLARE
  std_id UUID;
  std_price INTEGER;
  std_currency CHAR(3);
  std_period TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM plans WHERE key = 'standard') THEN
    SELECT pricing_cents, pricing_currency, pricing_period
      INTO std_price, std_currency, std_period
      FROM platform_settings WHERE id = 1;
    INSERT INTO plans (key, name, description, price_cents, currency, period, trial_eligible)
    VALUES (
      'standard', 'Standard', 'Full platform access for one food business.',
      COALESCE(std_price, 1999), COALESCE(std_currency, 'USD'), COALESCE(std_period, 'month'), TRUE
    )
    RETURNING id INTO std_id;

    -- Booleans mirror the current capability defaults (advanced_analytics off).
    INSERT INTO plan_entitlements (plan_id, capability_key, allowed) VALUES
      (std_id, 'storefront', TRUE),
      (std_id, 'products', TRUE),
      (std_id, 'categories', TRUE),
      (std_id, 'orders', TRUE),
      (std_id, 'pickup', TRUE),
      (std_id, 'delivery', TRUE),
      (std_id, 'delivery_groups', TRUE),
      (std_id, 'sharing', TRUE),
      (std_id, 'qr', TRUE),
      (std_id, 'basic_analytics', TRUE),
      (std_id, 'product_images', TRUE),
      (std_id, 'preorders', TRUE),
      (std_id, 'custom_notes', TRUE),
      (std_id, 'advanced_analytics', FALSE);

    -- Numeric limits inherit the business row (NULL = no plan override).
    INSERT INTO plan_entitlements (plan_id, capability_key, allowed, limit_value) VALUES
      (std_id, 'max_menu_items', TRUE, NULL);
  END IF;
END
$$;
