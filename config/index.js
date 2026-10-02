'use strict';

/**
 * Central environment configuration.
 * Reads and normalizes process.env once at startup; fails fast on invalid
 * production settings. Never logs secret values.
 */

const path = require('path');

function intEnv(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return n;
}

const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

let trustProxy = process.env.TRUST_PROXY || '0';
trustProxy = Number.parseInt(trustProxy, 10) >= 1 ? 1 : 0;

let appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
if (appUrl && !/^https?:\/\//i.test(appUrl)) {
  throw new Error('APP_URL must start with http:// or https://');
}

let sessionSecret = process.env.SESSION_SECRET || '';
if (isProd && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET must be set to at least 32 random characters in production.');
}
if (!sessionSecret && !isProd) {
  sessionSecret = `dev-insecure-secret-${Math.random().toString(36).slice(2)}`;
  // eslint-disable-next-line no-console
  console.warn('[config] WARNING: SESSION_SECRET not set — using an ephemeral dev secret.');
}

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
const maxUploadMb = Math.min(intEnv('MAX_UPLOAD_MB', 2), 5);

// Database connection. Two supported styles:
//  1. DATABASE_URL (any managed Postgres provider), or
//  2. Wasmer Edge managed database — Wasmer injects DB_HOST / DB_PORT /
//     DB_NAME / DB_USERNAME / DB_PASSWORD automatically when the app.yaml
//     declares `capabilities.database.engine: postgres`.
function resolveDbConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  if (process.env.DB_HOST && process.env.DB_NAME) {
    // Wasmer managed Postgres: TLS is mandatory and the certificate comes
    // from a private CA, so chain verification must stay off (per Wasmer docs).
    return {
      host: process.env.DB_HOST,
      port: Number.parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
    };
  }
  // Nothing configured — pool creation succeeds, queries fail loudly later.
  return { connectionString: '' };
}

const dbConfig = resolveDbConfig();
const dbHostForGuard = process.env.DB_HOST || '';

if (isProd && (!process.env.DATABASE_URL && !dbHostForGuard)) {
  throw new Error('Production requires a database: set DATABASE_URL or attach a Wasmer managed database (capabilities.database in app.yaml).');
}
// In production the database must be remote; refuse obvious local defaults.
if (
  isProd &&
  (/@localhost[:/]|@127\.0\.0\.1[:/]|@::1/.test(process.env.DATABASE_URL || '') ||
    /^(localhost|127\.0\.0\.1|::1)$/.test(dbHostForGuard))
) {
  throw new Error('Refusing to use a localhost database in production.');
}

const config = Object.freeze({
  env: nodeEnv,
  isProd,
  isTest,
  port: intEnv('PORT', 3000),
  appUrl,
  trustProxy,

  dbConfig,

  sessionSecret,
  sessionTtlMs: intEnv('SESSION_TTL_HOURS', 12) * 60 * 60 * 1000,
  cookieName: isProd ? '__Host-sid' : 'sid',

  uploadDir,
  maxUploadBytes: maxUploadMb * 1024 * 1024,

  // How long a customer may cancel their own order after placing it.
  customerCancelGraceMs: intEnv('CANCEL_GRACE_MINUTES', 15) * 60 * 1000,

  // Browser Web Push (owner new-order alerts). Single platform-wide VAPID
  // keypair; private key stays server-side and is never logged or exposed.
  // Push stays disabled unless explicitly enabled with keys configured.
  vapidPublicKey: (process.env.VAPID_PUBLIC_KEY || '').trim(),
  vapidPrivateKey: (process.env.VAPID_PRIVATE_KEY || '').trim(),
  vapidSubject: (process.env.VAPID_SUBJECT || '').trim(),
  pushEnabled: process.env.PUSH_ENABLED === '1' && Boolean((process.env.VAPID_PUBLIC_KEY || '').trim()),

  rateLimits: {
    global: { windowMs: intEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), max: intEnv('RATE_LIMIT_MAX', 300) },
    auth: { windowMs: intEnv('AUTH_RATE_WINDOW_MS', 15 * 60 * 1000), max: intEnv('AUTH_RATE_MAX', 10) },
    order: { windowMs: intEnv('ORDER_RATE_WINDOW_MS', 60 * 60 * 1000), max: intEnv('ORDER_RATE_MAX', 20) },
  },
});

module.exports = config;
