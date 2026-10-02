'use strict';

const { query } = require('../db/pool');

async function getTranslations(locale) {
  const { rows } = await query(
    'SELECT key, value FROM translations WHERE locale = $1',
    [locale]
  );
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

async function getAllTranslations() {
  const { rows } = await query('SELECT key, locale, value, updated_at FROM translations ORDER BY key, locale');
  return rows;
}

async function updateTranslation(key, locale, value) {
  const { rows } = await query(
    `INSERT INTO translations (key, locale, value, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key, locale)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING *`,
    [key, locale, value]
  );
  return rows[0] || null;
}

module.exports = { getTranslations, getAllTranslations, updateTranslation };
