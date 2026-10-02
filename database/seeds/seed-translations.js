'use strict';

/**
 * Seeds the translations table from the embedded dictionary in
 * client/js/i18n.js so server-managed overrides layer on top of a
 * complete base. Safe to re-run: upserts per (key, locale).
 *
 * Usage: node database/seeds/seed-translations.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../../server/db/pool');

async function seed() {
  const src = fs.readFileSync(path.join(__dirname, '../../client/js/i18n.js'), 'utf8');
  const start = src.indexOf('const DICT = {');
  const end = src.indexOf('\n  };', start);
  if (start === -1 || end === -1) throw new Error('DICT not found in i18n.js');
  const literal = src.slice(start + 'const DICT = '.length, end + 4);
  const DICT = eval('(' + literal + ')');

  let n = 0;
  for (const locale of Object.keys(DICT)) {
    for (const [key, value] of Object.entries(DICT[locale])) {
      await pool.query(
        `INSERT INTO translations (key, locale, value, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (key, locale) DO NOTHING`,
        [key, locale, String(value)]
      );
      n++;
    }
  }
  console.log(`Seeded ${n} translation rows`);
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
