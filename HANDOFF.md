# Restivo — Engineering Handoff & Product Spec

> **Purpose of this document:** a complete, self-contained description of the
> `restaurants-platform` project — what it is, how it is built, what it can do,
> how it looks, how it is deployed, and its known weak spots. It is written so
> that **another AI model (or a new engineer) can understand and modify the
> project without prior context**. Read it top-to-bottom before making changes.

---

## 1. What the product is

A **multi-tenant restaurant ordering SaaS** deployed on **Wasmer Edge**. A single
platform hosts many independent restaurants. Each restaurant gets its own
public storefront (a QR-code/menu page) where customers browse the menu, add
items to a cart, and place pickup or delivery orders via WhatsApp. Restaurant
staff manage the menu, hours, orders, and settings from an admin dashboard.
A **platform owner** (the SaaS operator) creates restaurants, creates their
admin accounts, sets limits, and — as of the latest build — manages the
**delivery companies** that restaurants can choose to deliver their orders.

Key product facts:
- **Arabic is the default language** and the UI is RTL; English is a toggle.
- Customers **do not need an account** — they order as guests and track by a
  code. Orders are sent to the restaurant over **WhatsApp** (deep-linked
  `wa.me` link), not email/SMS.
- The restaurant pays nothing per order in the current build; the operator
  intends to charge a monthly subscription later (not yet implemented).
- Images are stored **in the PostgreSQL database** (not disk) because Wasmer
  Edge has an ephemeral filesystem — local disk uploads were being wiped on
  every redeploy.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js >= 20 |
| Server | Express 4 (`express`), `helmet`, `express-session`, `connect-pg-simple`, `express-rate-limit` |
| Auth | `bcryptjs` password hashing, server-side sessions in Postgres |
| Database | PostgreSQL 17 (Wasmer-managed), driver `pg` |
| File uploads | `multer` (memory) → stored as `bytea` in `uploaded_files` table |
| QR codes | `qrcode` (server-generated PNG) |
| Frontend | Vanilla JS (no framework), `fetch` API, single `style.css` |
| Edge runtime | Wasmer Edge, `anybuild` remote build, `node-base` preset, EdgeJS precompile |
| i18n | Custom `client/js/i18n.js` dictionary (AR + EN) |

No build step for the frontend (static files served directly). No TypeScript.

---

## 3. Repository structure

```
restaurants-platform/
├── app.yaml                      # Wasmer App manifest (name MUST be "restaurants")
├── server.js                     # Express bootstrap, mounts routes, serves static
├── config/index.js               # reads DB_* env + SESSION_SECRET
├── server/
│   ├── db/pool.js                # pg Pool + withTx() helper
│   ├── middleware/               # auth (requireAuth/requireOwner/requireRole), sse, upload
│   ├── controllers/              # auth, public, admin, owner
│   ├── routes/                   # auth, public, admin, owner
│   ├── services/                 # restaurants, orders, users, settings, delivery, files
│   ├── validators/index.js       # request body validation + cleaning
│   └── utils/                    # errors, datetime, checks
├── database/
│   ├── migrate.js                # idempotent SQL migration runner
│   ├── migrations/001..005.sql   # schema
│   └── seeds/                    # seed-admin.js, seed-demo.js
├── client/
│   ├── index.html  login.html  restaurant.html  track.html  admin.html  owner.html
│   ├── css/style.css
│   └── js/  api.js i18n.js home.js restaurant.js track.js admin.js owner.js login.js
└── scripts/  check-syntax.js  autoretry-deploy.sh
```

---

## 4. Database schema

Migrations (all applied, idempotent): `001_init`, `002_order_items_created_at`,
`003_uploaded_files`, `004_orders_archived`, `005_delivery_groups`.

### Tables
- **restaurants** — `id`, `name`, `slug` (unique), `status`
  (`open|closed|temporarily_closed`), `is_active`, `max_menu_items`,
  `item_count_cache`, `created_at`, `owner_user_id`, `subscription_ends_at`.
- **users** — `id`, `role` (`owner|admin`), `restaurant_id` (nullable, FK),
  `username`, `email`, `password_hash`, `is_active`, `created_at`.
- **restaurant_settings** — per restaurant: `description`, `phone`, `whatsapp`,
  `address`, `logo_path`, `cover_path`, `primary_color`, `secondary_color`,
  `currency`, `delivery_fee_cents`, `timezone`, `ignore_opening_hours`.
- **restaurant_hours** — 7 rows (day 0–6): `is_closed`, `opens_at`, `closes_at`.
- **categories** — `id`, `restaurant_id`, `name`, `position`.
- **menu_items** — `id`, `restaurant_id`, `category_id`, `name`, `description`,
  `price_cents`, `image_path`, `is_available`, `is_popular`, `position`, `created_at`.
- **orders** — `id`, `restaurant_id`, `code` (track code), `customer_name`,
  `customer_whatsapp`, `customer_phone`, `customer_address`, `notes`,
  `order_type` (`pickup|delivery`), `status`, `subtotal_cents`,
  `delivery_fee_cents`, `total_cents`, `created_at`, `archived_at`.
- **order_items** — `id`, `order_id`, `item_id`, `name`, `price_cents`,
  `quantity`, `created_at`.
- **session** — connect-pg-simple session store.
- **uploaded_files** — `id`, `subdir` (`logos|covers|items`), `filename`,
  `mime`, `size`, `data` (`bytea`), `created_at`.
- **delivery_groups** — `id`, `name` (unique), `phone`, `notes`, `created_at`.
  Platform-level delivery companies.
- **restaurant_delivery_groups** — join table
  (`restaurant_id`, `group_id`) — which companies deliver for a restaurant.
- **restaurants.subscription_ends_at** — nullable timestamp. `NULL` or a future
  date means the subscription is **active**; a past date means **expired**.
  Currently used only to *display* status in the admin dashboard; billing
  enforcement is not implemented yet.

### Important invariants
- Revenue is counted **only for orders at/after `confirmed`** status
  (`REVENUE_STATUSES` in orders.service). Deleting an order **archives** it
  (`archived_at`) so revenue history is preserved.
- `image_path` values point at `/uploads/:subdir/:filename` which streams from
  `uploaded_files`. **Old disk images were lost** (ephemeral FS); any row
  referencing a missing file must be re-uploaded.
- Order status flow (typical): `pending → confirmed → preparing →
  out_for_delivery → delivered` (or `cancelled`).

---

## 5. API reference

All under `/api`. Admin/Owner routes require a valid session cookie.

### Auth — `/api/auth`
- `POST /login` `{username,password}` → session
- `POST /logout`
- `GET /me` → current user

### Public — `/api`
- `GET /restaurants` → directory of active restaurants (cover, logo,
  description, item count, live open/closed badge)
- `GET /restaurants/:slug/menu` → full storefront view: settings, hours,
  categories, items, `openNow`, **`deliveryGroups`** (names selected by the
  restaurant)
- `POST /restaurants/:slug/orders` → create guest order `{customerName,
  customerWhatsapp, customerPhone?, customerAddress?, notes?, orderType,
  items:[{itemId,quantity}]}`
- `GET /orders/track/:code` → public order status + items
- `GET /healthz` → `{ok:true}`

### Admin (restaurant) — `/api/admin`  (requireAuth, role=admin)
- `GET /restaurant`, `PATCH /status`
- `GET /dashboard`, `GET /analytics`, `GET /qr`, `GET /events` (SSE)
- Categories: `GET/POST /categories`, `PATCH/DELETE /categories/:id`
- Items: `GET/POST /items`, `PATCH/DELETE /items/:id`
- Orders: `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`,
  `DELETE /orders/:id`
- Settings: `GET /settings`, `PATCH /settings`, `GET /hours`, `PUT /hours`
- Delivery: `GET /delivery-groups` (all groups + `selected` flag for this
  restaurant), `PUT /delivery-groups` `{groupIds:[...]}`
- `POST /images?type=logos|covers|items[&itemId=]` → upload (DB-backed)

### Owner (platform) — `/api/owner`  (requireAuth, role=owner)
- `GET /overview` (counts + today revenue)
- Restaurants: `GET/POST /restaurants`, `GET/PATCH/DELETE /restaurants/:id`
- Admin users: `POST /restaurants/:id/admins`,
  `POST .../admins/:userId/reset-password`,
  `PATCH .../admins/:userId` (toggle active),
  `DELETE .../admins/:userId`
- `GET /restaurants/:id/orders`
- Delivery companies: `GET /delivery-groups`, `POST /delivery-groups`
  `{name,phone?,notes?}`, `PATCH /delivery-groups/:id`,
  `DELETE /delivery-groups/:id` (cascade-unlinks from restaurants)

---

## 6. Roles & features

### 6.1 Customer / storefront (`/`, `/restaurant/:slug`, `/track/:code`)
- **Homepage** (`/`): centered hero + "المطاعم / Restaurants" directory grid of
  all active restaurants with cover image, logo, open/closed badge, item count,
  and a search box. Cards link to the storefront.
- **Storefront**: category sections, item cards (price, image or letter-fallback),
  an **add-to-cart** with a fly-to-cart animation, a floating cart bar (pill),
  and a checkout sheet where the customer picks **pickup or delivery**, enters
  name + WhatsApp + address, and places the order. When delivery is selected and
  the restaurant has delivery companies, a muted line shows
  *"التوصيل بواسطة: …"*.
- **Track page**: enter the order code to see live status (polls `/track/:code`).
- Fully **Arabic-first, RTL**, with an EN toggle in the header.

### 6.2 Restaurant admin (`/admin.html`)
- Dashboard with live order feed (SSE) and KPIs.
- Menu management: categories + items (create/edit/delete, availability,
  popular flag, image upload at create **and** edit time, upload progress bar).
- Orders board: change status, archive/delete.
- Settings: description, phone, WhatsApp, address, timezone, currency, delivery
  fee, open/closed hours (7-day), brand colors, logo + cover upload, and the
  **Delivery companies** checkbox list (choose which deliver for this restaurant).
- QR code generator for the storefront link.

### 6.3 Platform owner (`/owner.html`)
- Overview stats (restaurants, active, orders today, revenue today).
- Create/edit/delete restaurants (with `max_menu_items` limit).
- Create admin accounts per restaurant, reset passwords, activate/deactivate.
- **Delivery companies management**: add/edit/delete delivery businesses, see
  how many restaurants use each. Bilingual (AR/EN) with the live language toggle.

---

## 7. Design / look & feel

- **Language & direction:** Arabic default, `dir="rtl"`, `lang="ar"`. English
  toggle re-renders all `data-i18n` strings. All customer + admin + login pages
  are bilingual; the **owner panel is English-only** (not yet localized).
- **Visual style:** dark, premium "glassmorphism" — blurred translucent cards on
  a deep gradient background, soft glows, rounded corners, subtle entrance
  animations (staggered fade/slide) and hover lifts. Primary/secondary brand
  colors are **per-restaurant** (settings) and tint the UI.
- **Layout:** responsive single-column on mobile, multi-column grids on desktop.
  Admin uses a sidebar + card sections; owner uses a topbar + stat cards + table.
- **Motion:** cart add "fly-to-cart" animation (WAAPI), card hover zoom on
  covers, page-load glow. Animations are decorative, not blocking.
- **Resilience:** broken/missing images degrade to a brand-gradient tile with the
  restaurant/item initial (prevents broken-image icons after the disk-wipe).

---

## 8. Internationalization

`client/js/i18n.js` holds an `AR` and `EN` dictionary plus `I.t(key)`,
`I.apply()`, `I.onChange()`, and a header toggle. Pages mark translatable text
with `data-i18n="key"`. Language is remembered in `localStorage` and toggled
live. **New UI strings must be added to BOTH dictionaries** or the key shows
literally.

As of feature 015, translations can also be overridden server-side: the
`translations` table (migration 030) is merged over the embedded dictionary on
boot via `GET /api/translations?locale=`; seed it with
`node database/seeds/seed-translations.js`. Storefronts default to their
`restaurant_settings.storefront_language`; `?lang=ar|en` overrides on both `/`
and `/restaurant/:slug`. SEO metadata per business comes from
`GET /api/seo/business/:slug` (`server/services/seo.service.js`), hero images
from `business_hero_images` (migration 031, max 6 per business).

---

## 9. Configuration & deployment

- **Wasmer App** `app.yaml`: `kind: wasmer.io/App.v0`, `name: restaurants`
  (**must equal the real app name `idkrealyyea/restaurants`** — mismatches cause
  `App name does not match the given app ID` and a failed deploy), `app_id:
  da_2qMIbt8UqjyZ`, `owner: idkrealyyea`, region `fr-roub1`, managed Postgres.
- **Env vars** (set in app.yaml `env` or Wasmer dashboard):
  `NODE_ENV=production`, `TRUST_PROXY=1`, `SESSION_SECRET`, and the
  `DB_*` connection vars (`DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD`)
  injected by Wasmer's database capability.
- **Migrations:** `DB_HOST=… DB_PORT=… DB_NAME=… DB_USERNAME=… DB_PASSWORD=… node
  database/migrate.js` (idempotent; run after schema changes).
- **Deploy:** `wasmer deploy --build-remote`. A remote build is required (no
  local `wasmer.toml`). The CLI version is pinned at 7.3.0.
- **Known deploy gotcha:** a stale `name:` in `app.yaml` (e.g.
  `restaurants-platform`) breaks every deploy with a GraphQL "App name does not
  match the given app ID" error. Keep `name: restaurants`.
- Static assets are cached ~1h on the CDN — **hard-refresh after deploys**.

---

## 10. Known limitations & bugs (fix before scaling)

1. ~~**Owner panel is English-only**~~ — FIXED: owner panel is now bilingual
   (AR/EN) with the live language toggle; see `I18N.onChange` re-render in
   `owner.js`.
2. **No subscription / billing enforcement** — the operator wants monthly
   per-restaurant fees; only the *status display* exists (admin dashboard shows
   active/expired based on `subscription_ends_at`). Billing, trials, and lockout
   of expired restaurants are not implemented.
3. **Lost images** — all pre-DB-backend uploads were wiped; any restaurant still
   referencing them shows letter-tiles until re-uploaded.
4. **No password recovery / email** — admins get passwords set by owner; no
   self-service reset, no email.
5. **No input sanitization of HTML in notes/description** beyond length limits —
   verify `esc()` is used everywhere user text is rendered (it is in admin/owner
   JS, but audit the storefront).
6. **Sessions in Postgres** — fine, but no session expiry/rotation policy coded;
   consider idle timeout.
7. **`/api/restaurants` directory** returns all active restaurants with no
   pagination — add `limit/offset` before many tenants exist.
8. **Owner delivery UI lacks edit form** — `PATCH /delivery-groups/:id` exists
   server-side but the owner UI only supports add/delete (name/phone not
   editable in place).
9. **No tests run in CI** — `node --test tests/` exists but is minimal.
10. **RTL in owner/settings tables** — owner page is LTR; mixed direction if a
    restaurant name is Arabic.

---

## 11. Suggested improvements (prioritized)

**High value, low effort**
- Localize the owner panel (reuse `I.t()` + `data-i18n`) for consistency.
- Add owner-side **edit** for delivery companies (wire existing `PATCH` route).
- Paginate `/api/restaurants` directory.

**Revenue / product**
- **Subscription system**: `restaurants.plan` + `subscription_ends_at`; block
  ordering (keep menu viewable) when expired; owner billing page; free trial
  via `max_menu_items` cap (already in schema). Consider Stripe or a local PSP.
- Per-order **commission option** as alternative to flat fee.

**Trust / safety**
- Add HTML sanitization on description/notes (e.g. DOMPurify) or strict
  server-side escape in `validate*`/`esc`.
- Admin password reset email / magic link; owner 2FA.
- Rate-limit public order creation harder (currently only login is limited).

**Scale / ops**
- Add CI: `npm run check` + `node --test` on every push; `wasmer deploy` on
  main.
- Back up `uploaded_files` / DB; add restore runbook.
- Cache the public menu view (it's read-heavy); add `Cache-Control` tuning.

**UX**
- Customer order confirmation screen + "reorder" link.
- Push/email notify restaurant on new order (not just WhatsApp).
- Multi-language menu items (AR + EN product names).

---

## 12. Quick mental model for an AI making changes

- **Add a field?** Migration → `restaurants.service`/`settings.service` →
  validator → controller route → admin.html + admin.js (settings) → i18n key →
  storefront render if customer-visible.
- **Add an endpoint?** Route file → controller → (service) → validator →
  (frontend js) → i18n.
- **Change the look?** Almost everything lives in `client/css/style.css`;
  brand colors come from `settings.primaryColor/secondaryColor` set as CSS vars
  at runtime in `restaurant.js`.
- **Never store uploads on disk** — use `POST /api/admin/images` →
  `files.service` → `uploaded_files`.
- **Deploy blocker reminder:** keep `app.yaml` `name: restaurants`.
```
