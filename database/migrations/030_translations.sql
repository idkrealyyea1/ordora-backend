-- 030_translations.sql — centralized platform translations
--
-- Stores all user-facing strings for all supported locales.
-- Seeded with existing i18n.js strings for ar/en.

CREATE TABLE IF NOT EXISTS translations (
  key        TEXT NOT NULL,
  locale     TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale),
  CONSTRAINT translations_locale_check CHECK (locale IN ('ar', 'en'))
);

CREATE INDEX IF NOT EXISTS translations_locale_idx ON translations (locale);
