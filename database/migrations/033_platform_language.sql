-- 033_platform_language.sql — per-user platform UI language
--
-- Stores the user's platform UI language preference.
-- Defaults to 'ar' for backward compatibility.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_language TEXT NOT NULL DEFAULT 'ar';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_platform_language_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_platform_language_check CHECK (platform_language IN ('ar', 'en'));
  END IF;
END
$$;
