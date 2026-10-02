# Restivo

A multi-tenant online-ordering SaaS: a platform owner creates restaurants; each restaurant gets a public menu page, a private dashboard, and receives orders from customers who never need an account.

**Stack:** Node.js 20+, Express, PostgreSQL, vanilla HTML/CSS/JS. No frontend framework, no Docker requirement, no local database.

---

## Architecture

```
MY LAPTOP                      REMOTE BUILD/RUN ENV                PRODUCTION
┌───────────────┐   files    ┌──────────────────────────┐        ┌─────────────────┐
│ source code   │──────────▶│ npm install / migrate /   │──────▶│ Wasmer Edge      │
│ config, docs  │            │ tests, app execution      │ deploy│  this app        │
└───────────────┘            └────────────┬─────────────┘        └────────┬────────┘
                                          ▼                               ▼
                                   disposable PostgreSQL          managed PostgreSQL
                                   (tests/dev only)               via DATABASE_URL
```

- **Frontend** (`client/`): static HTML/CSS/JS served by Express. CSP forbids inline scripts/styles.
- **Backend** (`server/`): REST API. routes → controllers → services → parameterized SQL.
- **Database** (`database/`): plain-SQL migrations + seeds. Prices are integer **cents**; orders **snapshot prices at purchase time**.

### Project structure

```
client/                 static pages + js/css/images
server/
  controllers/          HTTP glue
  services/             business logic + SQL
  middleware/           auth, CSRF/origin, rate limits, uploads, SSE
  validators/           input normalization (mass-assignment safe)
  db/pool.js            pg pool + transaction helper
  utils/                errors, validation checks, datetime/opening-hours, ids
database/
  migrations/001_init.sql
  migrate.js            idempotent runner
  seeds/                platform owner bootstrap + optional demo data
config/index.js         env loading/validation
tests/                  node:test suite (runs against TEST_DATABASE_URL only)
```

## Environment variables

Copy `.env.example` → `.env` and fill in real values (never commit `.env`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Remote PostgreSQL connection string |
| `SESSION_SECRET` | ≥32 random chars in production (`openssl rand -base64 48`) |
| `APP_URL` | Public base URL (QR codes/share links) |
| `NODE_ENV` | `production` enables Secure/`__Host-` cookies, HSTS, strict checks |
| `PORT`, `TRUST_PROXY` | Hosting-injected port / proxy hops |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Image storage root and per-file cap |
| `SUPER_ADMIN_USERNAME/PASSWORD` | Bootstrap owner account for `npm run seed:admin` |

Production guard rails: the app **refuses to start** with a localhost `DATABASE_URL` or a weak `SESSION_SECRET` when `NODE_ENV=production`.

## Running (remote execution environment)

```bash
npm ci                       # or npm install
cp .env.example .env         # fill in remote DATABASE_URL etc.
npm run migrate              # apply schema
npm run seed:admin           # create the platform owner from env
npm start                    # listens on $PORT
```

Optional demo restaurant (development only): `SEED_DEMO_PASSWORD=... npm run seed:demo` → logs in at `/login.html` as `burger-admin`.

## Testing (remote)

```bash
TEST_DATABASE_URL=postgresql://user:pass@disposable-host/testdb npm test
```

The suite refuses to run without an explicit `TEST_DATABASE_URL`. It migrates the schema into the target database, truncates all tables, boots the real app on an ephemeral port and covers:

- auth (login/logout/me, session revocation on password reset & deactivation, no user enumeration)
- **multi-tenant isolation** — restaurant A denied every read/write path into restaurant B (items, categories, orders, uploads, query-param spoofing, owner endpoints)
- backend-enforced menu limits (race-safe row lock), categories/items CRUD
- checkout math, price tampering ignored, delivery fee, availability, closed/outside-hours enforcement (server-side clock/timezone)
- status transition rules, tracking by code, price snapshotting after menu changes
- upload sniffing (MIME + magic bytes), QR, SSE auth, malformed bodies, cross-origin rejection, order rate limiting

## Deployment (Wasmer Edge + Wasmer managed PostgreSQL)

> **Full beginner-friendly walkthrough: [DEPLOYMENT.md](DEPLOYMENT.md)** — every click and command, no experience needed.

The app runs on Wasmer Edge with **Wasmer's own managed PostgreSQL** (`capabilities.database` in `app.yaml`). Wasmer injects `DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD` at runtime and `config/index.js` builds the connection automatically (TLS with Wasmer's private CA is handled). A `DATABASE_URL` for any other Postgres provider also works.

1. Provision a database region in `app.yaml` (`fr-roub1` Europe / `ca-beau1` Americas) — done once, permanently.
2. `wasmer deploy` → app + database are created; credentials via `wasmer app database list --with-password`.
3. Set the `SESSION_SECRET` secret, run `npm run migrate` + `npm run seed:admin` against the injected `DB_*` values.
4. `wasmer deploy` again.

Wasmer keeps automatic database backups ≥14 days; Pro includes 1 GB of DB storage.

## Security model (summary)

- Passwords: bcrypt (cost 12). Never returned by any API.
- Sessions: server-side store in Postgres, HttpOnly + SameSite=Lax cookies, `__Host-` prefix + Secure in prod, regeneration on login, immediate revocation on password reset/deactivation.
- Multi-tenancy: restaurant identity resolved **only** from the session user's DB record; all tenant queries are scoped by `restaurant_id`.
- Money: computed server-side from DB prices; client-sent totals/prices ignored entirely.
- CSRF: SameSite cookie + Origin-header check on mutating requests.
- Injection/XSS: parameterized SQL only; strict CSP (`default-src 'self'`, no inline); HTML escaping helper in all dynamic rendering.
- Uploads: magic-byte sniffing, MIME allow-list, size cap, random filenames inside fixed dirs, traversal-proof deletes.
- Rate limits: global API, login, and checkout limiters; JSON error envelope; centralized error handler that hides internals.

## Feature 015 (marketing localization)

- Hero-image carousel per business (`business_hero_images`), manageable from admin Settings and the owner restaurant modal; single image renders static, none falls back to the cover.
- Storefront menu grid: 1 column below 720px, 2 columns at 720px+; dish cards open an accessible product-detail bottom sheet (focus trap, Escape close) that feeds the existing cart.
- Hamburger drawer nav on `admin.html`/`owner.html` with capability-aware section filtering.
- Arabic/English everywhere: `?lang=` honored on `/` and `/restaurant/:slug`, preference persisted (`users.platform_language`, `restaurant_settings.storefront_language`), translations overridable via `translations` table (`GET /api/translations`, owner CRUD at `/api/owner/translations`).
- Locale-aware formatting: `Intl.NumberFormat`/`Intl.DateTimeFormat` with the active locale in `client/js/api.js`; per-business currency snapshots on orders.
- SEO: per-business metadata via `GET /api/seo/business/:slug` (Restaurant vs LocalBusiness JSON-LD, no fake ratings), `?lang=` hreflang in page heads and `sitemap.xml`, stricter `robots.txt`, `noindex` on all private pages.
- Seed translations: `node database/seeds/seed-translations.js`.

## Known limitations / roadmap

- Uploaded images live on the server filesystem. On ephemeral hosts (e.g. Wasmer Edge) they vanish on redeploy — wire Wasmer Volumes or S3-compatible storage into `server/middleware/upload.js` before relying on it in production.
- Rate limiting and the SSE hub are in-process (single instance). Add a shared store/bus before horizontal scaling.
- Analytics are basic aggregates; no exports yet.
