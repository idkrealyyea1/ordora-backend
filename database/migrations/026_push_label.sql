-- 026_push_label.sql — optional device label so owners can tell devices apart
--
-- Additive only: plain-text label shown in the dashboard device list.
-- Safe default ('') keeps existing rows valid; re-runs as no-op.

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_label_check'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_label_check CHECK (char_length(label) <= 60);
  END IF;
END
$$;
