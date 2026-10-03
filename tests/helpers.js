'use strict';

/**
 * Test bootstrap. Usage in every test file:
 *
 *   process.env.TEST_DATABASE_URL ||= 'postgresql://…';
 *   const { startApp } = require('./helpers');
 *   const env = await startApp();
 *
 * SAFETY: refuses to run unless TEST_DATABASE_URL is explicitly provided,
 * so the suite can never point at production data by accident.
 */

async function startApp({ orderRateMax, authRateMax } = {}) {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required. This suite runs against a disposable database only.');
  }

  // Configure environment BEFORE loading application modules.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-1234';
  const os = require('os');
  const fs = require('fs');
  const uploadDir = fs.mkdtempSync(require('path').join(os.tmpdir(), 'uploads-'));
  process.env.UPLOAD_DIR = uploadDir;
  if (orderRateMax) process.env.ORDER_RATE_MAX = String(orderRateMax);
  if (authRateMax) process.env.AUTH_RATE_MAX = String(authRateMax);

  // Fresh module graph per test process.
  const config = require('../config');
  const { pool, query } = require('../server/db/pool');
  const { migrate } = require('../database/migrate');
  const bcrypt = require('bcryptjs');

  await migrate();

  // Wipe everything between suites (schema_migrations + platform_settings preserved).
  // menu_item_images cascades from menu_items, listed explicitly so the new
  // table cannot leak state between suites if it is ever detached.
  await query(`TRUNCATE restaurants, users, orders, order_items, menu_items,
    menu_item_images, categories, restaurant_hours, restaurant_settings,
    delivery_groups, restaurant_delivery_groups, bookings, "session",
    notification_events, push_subscriptions RESTART IDENTITY CASCADE`);

  const { buildApp } = require('../server/app');
  const app = buildApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  /* ------------------------- HTTP helpers -------------------------- */

  async function req(path, { method = 'GET', body, cookie, raw } = {}) {
    const headers = {};
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      redirect: 'manual',
    });
    let data = null;
    if (!raw) {
      try {
        data = await res.json();
      } catch (_) {
        /* empty body */
      }
    }
    return { status: res.status, data, headers: res.headers };
  }

  /** Login and return the session cookie string. */
  async function login(identifier, password) {
    const res = await req('/api/auth/login', { method: 'POST', body: { identifier, password } });
    if (res.status !== 200) {
      throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
    }
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const sessionCookie = cookies.find((c) => c && (c.startsWith('__Host-sid=') || c.startsWith('sid=')));
    return sessionCookie.split(';')[0];
  }

  /* ------------------------ seeding helpers ------------------------ */

  async function createPlatformOwner(username, password) {
    const hash = await bcrypt.hash(password, 4);
    const res = await query(
      `INSERT INTO users (role, username, password_hash) VALUES ('owner', $1, $2) RETURNING id`,
      [username, hash]
    );
    return res.rows[0].id;
  }

  /** Platform staff session (for remit/isolation probes). */
  async function createStaffUser(username, password) {
    const hash = await bcrypt.hash(password, 4);
    await query(`INSERT INTO users (role, username, password_hash) VALUES ('staff', $1, $2)`, [
      username,
      hash,
    ]);
    return login(username, password);
  }

  /** Delivery credential (for retired-credential denial probes). */
  async function createDeliveryFixture({ groupName, username, password }) {
    const g = await query(`INSERT INTO delivery_groups (name) VALUES ($1) RETURNING id`, [groupName]);
    const hash = await bcrypt.hash(password, 4);
    await query(
      `INSERT INTO users (role, username, password_hash, delivery_group_id)
       VALUES ('delivery', $1, $2, $3)`,
      [username, hash, g.rows[0].id]
    );
    return { groupId: g.rows[0].id, cookie: await login(username, password) };
  }

  /**
   * Full tenant fixture through the PUBLIC API paths where possible:
   * returns { slug, adminCookie, categoryId, itemId }.
   */
  async function createRestaurantFixture(ownerCookie, { name, slug }) {
    const res = await req('/api/owner/restaurants', {
      method: 'POST',
      cookie: ownerCookie,
      body: {
        name,
        slug,
        maxMenuItems: 10,
        adminUsername: `${slug}-admin`,
        adminPassword: 'admin-password-123',
      },
    });
    if (res.status !== 201) throw new Error('fixture create failed: ' + JSON.stringify(res.data));

    const restaurantId = res.data.restaurant.id;
    const adminUsername = `${slug}-admin`;
    const adminCookie = await login(adminUsername, 'admin-password-123');

    const catRes = await req('/api/admin/categories', {
      method: 'POST', cookie: adminCookie, body: { name: 'Mains' },
    });

    const itemRes = await req('/api/admin/items', {
      method: 'POST',
      cookie: adminCookie,
      body: { categoryId: catRes.data.category.id, name: 'Test Burger', priceCents: 850 },
    });

    return { restaurantId, slug, adminCookie, adminUsername, adminPassword: 'admin-password-123', categoryId: catRes.data.category.id, itemId: itemRes.data.item.id };
  }

  return {
    config,
    pool,
    query,
    baseUrl,
    req,
    login,
    createPlatformOwner,
    createStaffUser,
    createDeliveryFixture,
    createRestaurantFixture,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
      try {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      } catch (_) {}
    },
  };
}

module.exports = { startApp };
