-- 029_subscriptions.sql — per-business subscription lifecycle + audit trail
--
-- Additive only. One authoritative row per business (UNIQUE restaurant_id also
-- prevents duplicate trials structurally). Existing rows are grandfathered:
-- subscription_ends_at is NEVER rewritten, plan links to the seeded plan,
-- stored status reflects the currently observable access (active/expired),
-- and no audit rows are invented for history not performed. Re-runs as no-op.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'grace', 'expired', 'cancelled', 'suspended')),
  trial_started_at TIMESTAMPTZ NULL,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NULL,
  grace_until TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancel_effective_at TIMESTAMPTZ NULL,
  suspended_at TIMESTAMPTZ NULL,
  suspend_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_plan_idx ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NULL,
  old_plan_key TEXT NULL,
  new_plan_key TEXT NULL,
  old_ends_at TIMESTAMPTZ NULL,
  new_ends_at TIMESTAMPTZ NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_restaurant_idx
  ON subscription_events (restaurant_id, created_at DESC);

-- Backfill: one row per pre-existing business. NULL end stays NULL (active
-- forever = clarified grandfather default); past ends keep their meaning.
DO $$
DECLARE
  std_id UUID;
BEGIN
  SELECT id INTO std_id FROM plans WHERE key = 'standard';
  IF std_id IS NULL THEN
    RAISE EXCEPTION '029_subscriptions.sql requires the seeded standard plan (run 028 first)';
  END IF;

  INSERT INTO subscriptions
    (restaurant_id, plan_id, status, current_period_start, current_period_end, grace_until)
  SELECT
    r.id,
    std_id,
    CASE
      WHEN r.subscription_ends_at IS NULL OR r.subscription_ends_at > now() THEN 'active'
      ELSE 'expired'
    END,
    r.created_at,
    r.subscription_ends_at,
    CASE
      WHEN r.subscription_ends_at IS NULL THEN NULL
      ELSE r.subscription_ends_at + INTERVAL '7 days'
    END
  FROM restaurants r
  WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.restaurant_id = r.id);
END
$$;
