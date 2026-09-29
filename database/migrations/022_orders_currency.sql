-- 022_orders_currency.sql — per-order currency snapshot (creation-time context)
--
-- Tracking and aggregates previously read the live business setting, so a
-- currency change relabeled history. Each order now carries the currency
-- that was valid at checkout. Backfill reproduces today's display exactly
-- (zero-regression for existing rows). Amounts are never touched.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS currency TEXT;

UPDATE orders o
  SET currency = UPPER(s.currency)
  FROM restaurant_settings s
  WHERE s.restaurant_id = o.restaurant_id
    AND o.currency IS NULL;

ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_currency_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_currency_check CHECK (char_length(currency) = 3 AND currency ~* '^[a-z]{3}$');
  END IF;
END
$$;
