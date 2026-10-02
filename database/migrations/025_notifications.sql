-- 025_notifications.sql — notification event dedup log plus Web Push subscription shape
--
-- Foundation for Tasks 11: order logic emits one domain event per change;
-- channels (dashboard SSE now, Web Push later) dedup on event_key.
-- Event rows are written AFTER order transactions commit and never roll
-- them back. Web Push sending stays default-off until VAPID keys are
-- configured; the table shape below is storage only, not a live channel.

CREATE TABLE IF NOT EXISTS notification_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  event_key     TEXT NOT NULL UNIQUE,
  event_type    TEXT NOT NULL,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_code    TEXT,
  status        TEXT,
  channel       TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'pending',
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_events_type CHECK (event_type IN ('order.created', 'order.status_changed')),
  CONSTRAINT notification_events_state CHECK (state IN ('pending', 'delivered', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS notification_events_restaurant_idx ON notification_events (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS notification_events_state_idx ON notification_events (state, created_at);

DROP TRIGGER IF EXISTS trg_notification_events_updated ON notification_events;
CREATE TRIGGER trg_notification_events_updated BEFORE UPDATE ON notification_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Web Push subscription storage (default-off; no live push in this phase).
-- restaurant_id NULL reserves future guest subscriptions; owner/staff rows
-- carry their business id. Endpoint is globally unique per push service.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_restaurant_idx ON push_subscriptions (restaurant_id);

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
