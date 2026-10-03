'use strict';

/**
 * HTTP entrypoint. Listens on process.env.PORT (never hardcoded) and
 * shuts down gracefully so hosting platforms can redeploy safely.
 *
 * Startup is fail-fast: a bounded database probe runs before listen in
 * every environment, so a broken app never serves traffic silently.
 */

const config = require('./config');
const { buildApp } = require('./server/app');
const { pool } = require('./server/db/pool');
const observe = require('./server/utils/observe');

async function dbReachable(timeoutMs = 8000) {
  const probe = pool.query('SELECT 1');
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('probe timeout')), timeoutMs));
  await Promise.race([probe, timeout]);
}

async function boot() {
  if (config.isProd) {
    try {
      const { migrate } = require('./database/migrate');
      await migrate();
      observe.info('migrate.up_to_date', {});
    } catch (err) {
      observe.error('migrate.failed', { message: err.message });
      process.exit(1);
    }
  }
  try {
    await dbReachable();
  } catch (err) {
    // Name the dependency, never the connection string or credentials.
    observe.error('boot.db_unreachable', { message: err.message });
    process.exit(1);
  }
  const app = buildApp();
  const server = app.listen(config.port, () => {
    observe.info('app.listening', { port: config.port, env: config.env });
  });

  function shutdown(signal) {
    observe.info('app.shutdown', { signal });
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    try {
      require('./server/middleware/sse').closeAll();
    } catch {
      /* hub already drained */
    }
    server.close(async () => {
      try {
        await pool.end();
      } catch {
        /* already closed */
      }
      observe.info('app.stopped', { signal });
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) boot().catch((e) => { console.error(e); process.exit(1); });
