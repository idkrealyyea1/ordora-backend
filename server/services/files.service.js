'use strict';

/**
 * Uploaded-file storage backed by PostgreSQL.
 * Hosting filesystems can be ephemeral — the database is the source of truth,
 * keyed by the same public paths previously used on local disk
 * (e.g. "/uploads/items/<uuid>.jpg").
 */

const { query } = require('../db/pool');

const PUBLIC_PATH_RE = /^\/uploads\/(logos|covers|items|hero)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

async function put(path, mime, buffer) {
  if (!PUBLIC_PATH_RE.test(path)) throw new Error('Refusing to store non-public path');
  await query(
    `INSERT INTO uploaded_files (path, mime, bytes, size_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (path) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, size_bytes = EXCLUDED.size_bytes`,
    [path, mime, buffer, buffer.length]
  );
}

async function get(path) {
  const { rows } = await query(
    'SELECT mime, bytes FROM uploaded_files WHERE path = $1',
    [path]
  );
  return rows[0] || null;
}

async function remove(path) {
  await query('DELETE FROM uploaded_files WHERE path = $1', [path]);
}

module.exports = { put, get, remove, PUBLIC_PATH_RE };
