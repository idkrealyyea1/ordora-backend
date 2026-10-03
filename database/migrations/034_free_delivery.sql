-- 034: optional free-delivery threshold per business.
-- Backward compatible: disabled by default, threshold 0 (normal fee behavior).
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS free_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold_cents INTEGER NOT NULL DEFAULT 0
    CHECK (free_delivery_threshold_cents >= 0 AND free_delivery_threshold_cents <= 1000000);
