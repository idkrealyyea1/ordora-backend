# Deploy Guide — Supabase (database) + Render (backend) + Cloudflare Pages (frontend)

> This is the **complete, click-by-click** procedure. Follow it top to bottom.
> Nothing is skipped and no step assumes prior knowledge of these dashboards.
>
> **Wasmer keeps working.** `app.yaml` was not touched and every new behavior
> below is off by default (same-origin). `wasmer deploy --build-remote` works
> exactly as before against Wasmer's managed database. Use a **separate**
> Supabase database for this stack — do not point Render and Wasmer at the
> same database.

## 0. What you are building (architecture)

```
Supabase (Postgres)  ◄──  Render Web Service (Node API + static client, same origin)
                                ▲
Cloudflare Pages (static copy of client/) ── API calls ──┘  (optional split frontend)
```

- **Recommended:** Supabase + Render alone. The Render service serves the API
  **and** the website from one URL (same as Wasmer does today). Stop after
  Part B and you are live.
- **Optional:** Part C mirrors the `client/` folder onto Cloudflare Pages
  (global CDN). The Pages copy sends its API calls to Render. Needed code
  support is already in the repo (`api-base` meta tag, fetch/img prefixing,
  CORS, `FRONTEND_URL`, `COOKIE_SAMESITE`, `client/_redirects`).

Repo changes that enable this stack (Wasmer defaults unchanged):

| File | Change |
|---|---|
| `config/index.js` | TLS on `DATABASE_URL` (Supabase mandates it; localhost exempt); new optional `FRONTEND_URL`, `COOKIE_SAMESITE` (`lax` default) |
| `server/app.js` | CORS headers + preflight **only** when `FRONTEND_URL` is set; session cookie `SameSite=None; Secure` **only** when `COOKIE_SAMESITE=none` |
| `server/middleware/csrf.js` | Origin allowlist also accepts `FRONTEND_URL` host; everything else still `403 BAD_ORIGIN` |
| `client/js/api.js`, `client/js/i18n.js` | Prefix `/api/*` + `/uploads/*` with the backend base **only** when configured; `credentials: 'include'` |
| `client/js/*.js` (restaurant, offer, i18n, site, admin) | Session-carrying requests/EventSource work cross-site |
| `client/*.html` (21 files) | Empty `<meta name="api-base" content="">` (= same origin; Pages users stamp their Render URL in) |
| `client/_redirects` | Extensionless routes (`/restaurant/:slug`, `/track`, …) for Pages static hosting |
| `render.yaml` | Render Blueprint (build/start/migrate/health check) |
| `.env.example` | Documents the new variables |
| `tests/split-frontend.test.js` | CORS/allowlist/parity regression tests |

---

## PART A — Supabase (Postgres database) — ~10 minutes

### A1. Create an account and organization
1. Go to **https://supabase.com** → **Start your project** → sign up (GitHub
   login is fastest).
2. After login you land on the dashboard. If asked, create an **organization**
   (any name, e.g. `restivo`, free plan is fine).

### A2. Create the database project
1. Click **New project**.
2. **Name:** `restaurants` (anything).
3. **Database Password:** click **Generate a password** → **copy it immediately**
   into a private note (you cannot see it again). Call it `<DB_PASSWORD>`.
4. **Region:** pick the one closest to your Render region (you will create the
   Render service in the next part — e.g. `Frankfurt (eu-central)`; write it
   down and use the same region on Render).
5. **Pricing Plan:** Free. Click **Create new project**.
6. Wait 2–3 minutes until status is **Active** (green).

### A3. Copy the connection string (Session pooler)
1. In the Supabase project sidebar click **Connect** (top bar) → tab **ORMs** or
   **Connection string**.
2. Switch the dropdown from **Direct connection** to **Session pooler**
   (port `5432` — this one survives serverless restarts correctly).
3. Reveal the password, and copy the URI. It looks like:
   ```
   postgresql://postgres.<REF>:<DB_PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
   If your `<DB_PASSWORD>` contains special characters (`@`, `/`, `#`, …),
   percent-encode them (`@`→`%40`, `/`→`%2F`, `#`→`%23`). Call this
   `<DATABASE_URL>`.
4. Keep this tab open — you need `<DATABASE_URL>` in Part B step B5.

### A4. (Optional sanity check, 1 minute)
1. Sidebar → **SQL Editor** → **New query** → run `select version();`
2. You should see one row with `PostgreSQL 15.x ...`. This proves the DB is up.
   Close the editor. (Migrations run automatically on Render in Part B.)

---

## PART B — Render (Node backend, full-stack) — ~15 minutes

### B1. Push this repo to GitHub (if it is not there yet)
1. On **https://github.com/new** create a repository (private is fine).
2. On your machine, inside the project folder:
   ```bash
   git add -A
   git commit -m "feat: Supabase/Render/Pages stack alongside Wasmer"
   git branch -M main
   git remote add origin https://github.com/<YOU>/<REPO>.git
   git push -u origin main
   ```

### B2. Create the Render account
1. Go to **https://render.com** → **Get Started** → sign up with the **same
   GitHub account** (one click connects your repos).

### B3. Create the Web Service from `render.yaml`
1. Dashboard → **New +** → **Web Service** → **Build and deploy from a Git
   repository** → **Connect** your `<YOU>/<REPO>` repo → select it.
2. Render auto-detects `render.yaml`. Confirm these values (edit if needed):
   - **Name:** `restaurants-api` (your URL becomes
     `https://restaurants-api.onrender.com` — write it down as `<RENDER_URL>`).
   - **Region:** same as Supabase (e.g. `Frankfurt (EU Central)`).
   - **Runtime:** `Node`.
   - **Build Command:** `npm ci`
   - **Start Command:** `node server.js`
   - **Pre-Deploy Command:** `npm run migrate` (runs all SQL migrations
     idempotently before every deploy — safe to re-run).
   - **Health Check Path:** `/api/healthz`
   - **Instance Type:** `Free`.
3. Click **Create Web Service** but expect the first deploy to fail (no
   database configured yet — normal). Continue to B5.

### B4. Generate the session secret (on your machine)
```bash
openssl rand -base64 48
```
Copy the output — this is `<SESSION_SECRET>` (must be ≥ 32 characters).

### B5. Set environment variables (Render → service → Environment)
Add **each** of these exactly (key = left, value = right):

| Key | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Enables prod headers, secure cookies, boot migrations |
| `TRUST_PROXY` | `1` | Render terminates TLS in front of us; required for secure cookies + correct IPs |
| `DATABASE_URL` | `<DATABASE_URL>` from step A3 | Supabase Session pooler URI |
| `SESSION_SECRET` | `<SESSION_SECRET>` from step B4 | Signs admin/owner sessions |
| `APP_URL` | `<RENDER_URL>` e.g. `https://restaurants-api.onrender.com` | QR codes, share links, sitemap canonical |
| `FRONTEND_URL` | *(leave empty for now)* | Only for Part C (Pages). Empty = same-origin |
| `COOKIE_SAMESITE` | `lax` | Same-origin default. Change to `none` only in Part C step C5 |

Click **Save Changes** — this triggers a deploy.

### B6. Watch the first deploy
1. Open the **Logs** tab. You must see, in order:
   - `npm ci` finishing,
   - `npm run migrate` printing `apply 001_...sql` lines then
     `Migrations up to date.`,
   - `[app] listening on port ... (production)`.
2. If the deploy is red, jump to **Troubleshooting** (bottom) before continuing.

### B7. Create the owner account (Render Shell)
1. Service page → **Shell** tab (right side) → wait for a prompt.
2. Run (replace with your own values):
   ```bash
   SUPER_ADMIN_USERNAME=owner \
   SUPER_ADMIN_PASSWORD='<pick-a-strong-password-12+-chars>' \
   npm run seed:admin
   ```
3. You must see a success line with the username. **Save the password now.**

### B8. Verify the backend (do all 5 checks)
1. Open `<RENDER_URL>/api/healthz` → must show `{"ok":true}`.
2. Open `<RENDER_URL>/login.html` → log in with the owner account from B7 →
   you land on the owner dashboard.
3. Owner dashboard → create a restaurant + admin (same flow as Wasmer).
4. Open `<RENDER_URL>/restaurant/<slug>` → menu loads; place a test order.
5. Hard-refresh once (`Ctrl+Shift+R`) — static assets cache ~1h on first load.
6. **You are live on Render.** If you do NOT want the Pages CDN frontend,
   stop here.

---

## PART C — Cloudflare Pages (CDN frontend, optional) — ~10 minutes

> Skip this entire part if `<RENDER_URL>` alone is enough for you.

### C1. Stamp your Render URL into the frontend copy
On your machine, in the project folder, run **one** command (replace the URL):

```bash
grep -rl 'name="api-base"' client --include='*.html' \
  | xargs sed -i 's|<meta name="api-base" content=""|<meta name="api-base" content="https://restaurants-api.onrender.com"|'
```

Verify (must print `content="https://..."` 21 times, all identical):

```bash
grep -rho 'name="api-base" content="[^"]*"' client --include='*.html' | sort | uniq -c
```

> Why: the wrapper in `client/js/api.js` + `client/js/i18n.js` prefixes every
> `/api/*` fetch, upload, EventSource and `/uploads/*` image with this base.
> Wasmer/Render-git copies keep `content=""` (= same origin, zero change).

### C2. Create the Pages project (Upload assets — simplest, no Git needed)
1. Go to **https://dash.cloudflare.com** → sign up/log in → left sidebar
   **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. **Project name:** e.g. `restaurants-web`. Your site becomes
   `https://restaurants-web.pages.dev` — write it down as `<PAGES_URL>`.
3. Drag-and-drop (or select) the **`client/` folder contents**
   (all files inside `client/`, including `_redirects`, `index.html`, `js/`,
   `css/`, `demo/`, `app/`) — **not** the whole repo.
4. Click **Deploy site**. Wait ~1 minute → **Success**.

### C3. (Alternative to C2: Git-connected Pages)
1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select
   `<YOU>/<REPO>`.
2. **Build command:** *(leave empty)*. **Output directory:** `client`.
3. Deploy. (With Git-connected Pages you must commit the stamped meta from C1,
   or re-run C1 before each upload.)

### C4. Verify the Pages site (public flows, no login yet)
1. Open `<PAGES_URL>` → landing loads (no console errors).
2. Open `<PAGES_URL>/restaurant/<slug>` → **same menu as Render** (this proves
   the api-base + `_redirects` rewrite work).
3. Food/logo images load (proves `/uploads/*` prefixing works).
4. Place a test order as a guest (proves cross-origin checkout works).

### C5. Point Render at Pages (unlocks logins/admin on the Pages URL)
Cross-site admin sessions need two Render settings:
1. Render → your service → **Environment** → set:
   - `FRONTEND_URL` = `<PAGES_URL>` (exact scheme + host, e.g.
     `https://restaurants-web.pages.dev` — **no trailing slash**).
   - `COOKIE_SAMESITE` = `none` (so the session cookie is sent with
     cross-site fetch/EventSource; requires HTTPS, which Render has).
2. **Save Changes** → wait for redeploy (migrations re-run harmlessly).

### C6. Verify the Pages site (authenticated flows)
1. Open `<PAGES_URL>/login.html` → log in as owner/admin → dashboard loads.
2. Admin dashboard → place a test item edit; keep the dashboard open, place a
   guest order in another tab → the order appears live (proves cross-site SSE
   + cookies work).
3. If login loops back to the login page: see **T4** in Troubleshooting.

### C7. (Optional) Custom domains
- **Render:** service → **Settings** → **Custom Domains** → add
  `api.yourdomain.com` → add the shown CNAME at your DNS → set `APP_URL` +
  `FRONTEND_URL` to the final URLs → redeploy.
- **Pages:** Pages project → **Custom domains** → add `www.yourdomain.com` →
  follow the DNS prompt → re-stamp C1 only if the API host changed (it didn't;
  the frontend host is irrelevant to `api-base`).

---

## PART D — Keeping Wasmer working (read once)

1. `app.yaml` was **not modified** — `wasmer deploy --build-remote` behaves
   exactly as before.
2. All new server behavior is gated behind env vars that Wasmer does not set
   (`FRONTEND_URL` empty → no CORS headers, `same-origin` CORP, `SameSite=Lax`
   cookies, Wasmer `DB_*` connection path untouched).
3. Keep the databases separate: Wasmer → its managed Postgres; Render → your
   Supabase project. Never paste the Supabase URI into Wasmer env (and never
   paste Wasmer `DB_*` creds into Render).
4. The 21 empty `<meta name="api-base" content="">` tags are inert on Wasmer
   (empty = same origin). Do not commit a stamped Render URL to `main` if you
   still deploy Wasmer from `main` — stamp only your Pages upload copy (C1).

---

## Troubleshooting

| # | Symptom | Cause → Fix |
|---|---|---|
| T1 | Render logs: `db_unreachable` / `password authentication failed` | Wrong `<DATABASE_URL>`: re-copy the **Session pooler** URI (A3), URL-encode special chars in the password, no trailing spaces. |
| T2 | Render logs: `SESSION_SECRET must be set...` | `SESSION_SECRET` missing or < 32 chars → regenerate (B4), save. |
| T3 | Render logs: `Production requires a database` | `DATABASE_URL` empty → set it (B5), save. |
| T4 | Pages login loops / dashboard kicks back to login | `FRONTEND_URL` mismatch (must equal `<PAGES_URL>` exactly, no trailing slash) **or** `COOKIE_SAMESITE` not `none` → fix both (C5), redeploy Render, close + reopen the tab. |
| T5 | Pages shows menu but images are broken | Stale upload (pre-C1 stamp) or old cached page → re-upload stamped copy, hard-refresh. Images never stored on disk/edge — re-upload them in admin if they 404 on Render too. |
| T6 | `403 BAD_ORIGIN` on Pages POSTs | `FRONTEND_URL` not set to the exact Pages host → C5. (Unknown origins stay rejected by design.) |
| T7 | Pages `/restaurant/x` shows 404 | `_redirects` missing from the upload → re-upload including `client/_redirects` (C2 step 3). |
| T8 | Migrate step red: `migration ... failed` | Database already partially migrated by another tool → Supabase SQL Editor: inspect `schema_migrations`, restore from a backup if needed; migrations are idempotent on retry. |
| T9 | Free Render service is slow on first hit | Free instances sleep after inactivity (~50s cold start). Upgrade to Starter ($7/mo) or accept it; Wasmer Edge stays instant. |
| T10 | `npm ci` fails on Render | Node version drift → Render uses Node 20+ by default (repo requires `>=20`); check the build log for the exact package error. |

---

## Final checklist (all stacks)

- [ ] `<RENDER_URL>/api/healthz` → `{"ok":true}`
- [ ] Owner login on Render works; restaurant + admin created
- [ ] Guest order on `<RENDER_URL>/restaurant/<slug>` succeeds and appears in admin
- [ ] (Pages) Same three checks pass on `<PAGES_URL>`
- [ ] (Pages) Admin login + live order SSE work on `<PAGES_URL>`
- [ ] `wasmer deploy --build-remote` still succeeds (Wasmer untouched)
- [ ] `npm run check` → 0 failures; `node --test tests/split-frontend.test.js` → green (needs `TEST_DATABASE_URL`)

*End of guide — Supabase holds the data, Render runs the app, Pages (optional) serves the edge frontend, Wasmer keeps deploying as before.*
