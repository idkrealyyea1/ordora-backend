-- 027_onboarding_state.sql — self-service onboarding progress on restaurants
--
-- Additive only: status + step columns so interrupted wizards resume.
-- Safe defaults ('completed'/'done') keep existing and admin-created rows
-- valid without re-onboarding; re-runs as no-op.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'completed';

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'done';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_onboarding_status_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_onboarding_status_check
      CHECK (onboarding_status IN ('in_progress', 'completed'));
  END IF;
END
$$;
