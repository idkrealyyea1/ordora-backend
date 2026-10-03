# 🚀 Deployment Guide — 100% Wasmer (App + Database)

This guide takes you from **zero** to a **live restaurant ordering platform** using **only Wasmer** — the app **and** its PostgreSQL database both live inside your Wasmer Pro account. No Neon, no third-party database needed.

You do not need to understand everything. Follow the steps in order, copy-paste the commands, and replace anything written like `<LIKE_THIS>` with your own values.

---

## What you will set up

```
Your customers ──▶ Wasmer Edge app (https://your-app.wasmer.app)
                          │
                          ▼
              Wasmer managed PostgreSQL        ← same platform, created automatically
              (auto-backed-up for 14 days)
```

| Piece | Where it runs | Your plan |
|---|---|---|
| The application | Wasmer Edge | Pro ($10/mo) |
| PostgreSQL database | Wasmer Edge (managed) | Included with Pro (1 GB storage included) |

> 📍 **One thing to know:** Wasmer databases only exist in two regions:
> - `fr-roub1` — France (best for Europe/Africa/Middle East)
> - `ca-beau1` — Canada (best for the Americas)
>
> You choose once, below. It cannot be changed later without recreating the database.

### Before you start, you need

- [ ] This project folder on your computer
- [ ] Node.js 20+ installed (`node --version` prints v20 or higher)
- [ ] A terminal (Terminal on Mac/Linux; WSL or Git Bash on Windows)
- [ ] Your **Wasmer Pro** account

---

# Part A — Install the CLI and log in

### A1. Install

Mac or Linux (including WSL):

```bash
curl https://get.wasmer.io -sSfL | sh
```

Close and reopen your terminal, then check:

```bash
wasmer --version
```

(Windows without WSL: installer at https://docs.wasmer.io/install)

### A2. Log in

```bash
wasmer login
```

A link opens in your browser → click **Approve**. Terminal confirms you're logged in.

---

# Part B — Choose your database region (one-time)

Open the file **`app.yaml`** in this folder with any text editor and find these lines at the bottom:

```yaml
locality:
  regions:
    - fr-roub1
```

- Customers mostly in **Europe / Africa / Middle East**? → keep `fr-roub1`
- Customers mostly in **North / South America**? → change it to `ca-beau1`

Save the file. ⚠️ After the first deploy this choice is effectively permanent — the database lives in that region forever.

---

# Part C — First deploy (creates the app AND the database)

In the terminal, inside this project folder:

```bash
cd Desktop/restaurants     # adjust to wherever the folder is
npm install                # downloads dependencies (~1 minute)
wasmer deploy
```

Answer the prompts:

| Prompt | Answer |
|---|---|
| Publish package `restaurants-platform`? | **yes** |
| Bump version? | **yes** |
| App owner | press Enter (your username) |
| App name | press Enter (`restaurants-platform`) |

Because of the `capabilities.database` section in `app.yaml`, Wasmer now **automatically provisions your managed PostgreSQL database**. Provisioning takes a few minutes on the first deploy.

When it finishes it prints your live URL:

```
✅ App deployed!
https://restaurants-platform-<your-username>.wasmer.app
```

📌 **Write that URL down.** Call it `<YOUR_APP_URL>`.

> ❓ Opening the URL now shows an error page? **Expected.** The app refuses to start until we give it its session secret — next part fixes that.

---

# Part D — Add the session secret and redeploy

The app needs one secret to protect logins.

### D1. Generate it

```bash
openssl rand -base64 48
```

(If `openssl` is missing: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`)

Copy the output → that's your `<SESSION_SECRET>`.

### D2. Register it with Wasmer

Stay inside the project folder so Wasmer knows which app you mean:

```bash
wasmer app secrets create SESSION_SECRET "paste-the-long-random-string-here"
```

Keep the quotes.

### D3. Redeploy

Secrets only activate on the next deployment:

```bash
wasmer deploy
```

(Confirm the version bump with yes.)

Now open `<YOUR_APP_URL>/api/healthz` → you should see:

```json
{"ok":true}
```

✅ The app is running and connected to its Wasmer database (the connection details are injected into the app automatically — no passwords in any file).

---

# Part E — Create the tables and your owner account

The database is empty right now. We'll send it the schema, then create your boss account. These commands just talk to the remote database over the internet — safe to run from here.

### E1. Get the database credentials

```bash
wasmer app database list --with-password
```

It prints something like:

```
NAME        HOST                       PORT   USERNAME   PASSWORD
db_ab12cd34 psql.fr-roub1.db.wasmer.cc 12345  db_user    S3cret...
```

📌 Keep this terminal output handy. You can also see the same values in the wasmer.io dashboard → your app → **Databases** tab (click the eye icon for the password).

### E2. Run the migration (creates all tables)

Set the five values from the previous step as environment variables, then run migrate.

**Mac/Linux (one line):**

```bash
DB_HOST="psql.fr-roub1.db.wasmer.cc" DB_PORT="12345" DB_NAME="db_ab12cd34" DB_USERNAME="db_user" DB_PASSWORD="S3cret..." npm run migrate
```

**Windows PowerShell:**

```powershell
$env:DB_HOST="psql.fr-roub1.db.wasmer.cc"; $env:DB_PORT="12345"; $env:DB_NAME="db_ab12cd34"; $env:DB_USERNAME="db_user"; $env:DB_PASSWORD="S3cret..."; npm run migrate
```

Success looks like:

```
apply 001_init.sql
Migrations up to date.
```

(The app connects with encryption even though Wasmer uses a private certificate — the code already handles that.)

### E3. Create your platform-owner account

Same pattern, plus your chosen username/password (min 10 characters):

**Mac/Linux:**

```bash
DB_HOST="..." DB_PORT="..." DB_NAME="..." DB_USERNAME="..." DB_PASSWORD="..." SUPER_ADMIN_USERNAME=owner SUPER_ADMIN_PASSWORD="pick-a-strong-password" npm run seed:admin
```

**Windows PowerShell:**

```powershell
$env:DB_HOST="..."; ... ; $env:SUPER_ADMIN_USERNAME="owner"; $env:SUPER_ADMIN_PASSWORD="pick-a-strong-password"; npm run seed:admin
```

This account controls every restaurant on your platform — make the password strong.

---

# Part F — Test everything

1. Open **`<YOUR_APP_URL>/login.html`** → log in with the owner username/password from E3.
2. Click **New restaurant** → name it (e.g. "Burger House"), set max menu items (e.g. 30), fill in an admin username + password → **Create restaurant**.
   - If a password was auto-generated, save it NOW — shown only once.
3. Log out → log back in as that **restaurant admin**.
4. **Menu** tab → add categories and items with prices.
5. **Share & QR** tab → open the public page → add items to cart → place a test order.
6. Back in the dashboard → **Orders** tab → the order appears (live!).

🎉 Live SaaS, fully on Wasmer.

---

# Part G — Final touches

### G1. Point QR codes at your real URL

Edit `app.yaml`, uncomment and set `APP_URL` under `env:`:

```yaml
env:
  NODE_ENV: production
  TRUST_PROXY: "1"
  APP_URL: "https://restaurants-platform-<your-username>.wasmer.app"
```

Redeploy:

```bash
wasmer deploy
```

### G2. Custom domain (optional)

wasmer.io dashboard → your app → **Settings → Domains** → follow the DNS instructions. Update `APP_URL` afterwards and redeploy.

### G3. Things worth knowing about your Wasmer database

| Fact | Detail |
|---|---|
| **Backups** | Automatic, kept ≥14 days. Restore = contact Wasmer support. Export anytime with `pg_dump`. |
| **Credential rotation** | Dashboard → Databases → *Rotate Credentials*. The app picks up new credentials instantly; external tools (your laptop) need the new values. |
| **Database explorer** | Dashboard → Databases → *Go to DB Explorer* — browse tables in the browser, auto-logged-in. |
| **Limits** | One database per app; engine can never change (it's PostgreSQL ✅); only regions `fr-roub1` / `ca-beau1`. |
| **Storage quota** | Pro includes 1 GB of database storage (then ~$10/GB overage) — thousands of orders fit in 1 GB. |

### G4. Known limitation: uploaded images

Menu photos/logo uploads currently store on the app's ephemeral disk and can disappear on redeploy. Two fixes when you're ready (ask me):
- Wire **Wasmer Volumes** (persistent disk, available in `fr-roub1`/`ca-beau1`) as the upload directory, or
- Plug in cloud object storage.

---

# Updating later

Code changed?

```bash
wasmer deploy
```

Database changes = new file in `database/migrations/` → re-run the E2 command once. Old deployments stay rollback-ready in the dashboard.

---

# Troubleshooting

| Problem | Fix |
|---|---|
| Error page after Part C | Expected until Part D done. Still broken after D3? Dashboard → Logs. Usually a missing/misspelled `SESSION_SECRET`. |
| `Unsupported database engine 'psql'` on deploy | In `app.yaml` the value must be exactly `engine: postgres` (not `psql`). |
| `Region ... does not support databases` | Use only `fr-roub1` or `ca-beau1` in `locality.regions`. |
| `Apps with databases must specify a single region` | Keep exactly ONE region listed in `app.yaml`. |
| `conflict: App already has an active database` | One DB per app — delete it in the dashboard first (⚠️ destroys data). |
| Migration fails with certificate/TLS error | Make sure you're running the current code (`git pull`) — `config/index.js` handles Wasmer's private CA automatically. |
| Migration fails with `ENOTFOUND` / timeout | Wrong `DB_HOST`/`DB_PORT` — copy them again via `wasmer app database list --with-password`. Also check your network allows outbound connections. |
| `password authentication failed` | Password rotated or mistyped — fetch fresh values with `--with-password`. |
| Deploy asks weird manifest questions | Delete `wasmer.toml` and run `wasmer deploy` again — Express apps auto-detect from `package.json`. |
| Cold start slow on first visit after idle | Normal scale-to-zero behavior (~a second). |

---

# Quick reference

| Thing | Where |
|---|---|
| App + env config | `app.yaml` in this repo |
| Secrets (`SESSION_SECRET`) | `wasmer app secrets create …` or dashboard → Settings → Secrets |
| Database + credentials | Dashboard → your app → **Databases** tab (or `wasmer app database list --with-password`) |
| Logs | Dashboard → your app → Logs |
| DB browser | Dashboard → Databases → Go to DB Explorer |
| Official docs | https://docs.wasmer.io/edge/learn/databases |

---

*Verified against Wasmer documentation: August 2026.*

---

# Part D — Production deploy pipeline (Task 17, FR-018)

> No production change ships without explicit human approval. Automation stops
> at validation; a human runs the deploy.

```
CHECK → TEST → MIGRATION VALIDATION → STARTUP VALIDATION → DEPLOY → HEALTH CHECK → SMOKE TEST → MONITOR
```

1. **CHECK**: `npm run check` — 0 failures required.
2. **TEST**: `TEST_DATABASE_URL=<disposable> node --test tests/` — full suite green.
3. **MIGRATION VALIDATION**: `node database/migrate.js` against a disposable copy first; confirm idempotent re-run skips (`skip <file> (already applied)`), no destructive statements without a documented path.
4. **STARTUP VALIDATION**: boot against the disposable DB; missing `SESSION_SECRET`/DB fails fast with a naming-but-not-leaking message; `GET /api/readyz` is 200 only after the DB answers.
5. **DEPLOY**: `wasmer deploy --build-remote` (keep `app.yaml` `name: restaurants`).
6. **HEALTH CHECK**: `GET /api/healthz` → 200 (liveness), then `GET /api/readyz` → 200 (traffic may flow).
7. **SMOKE TEST**: `/`, `/app/`, `/restaurant/:slug`, `/track`, login, admin + owner dashboards, `/api/pricing`, `/robots.txt`, `/sitemap.xml`, unknown path → `404.html` (JSON for `/api/*`).
8. **MONITOR**: watch logs for `app.listening` / `migrate.failed` / `boot.db_unreachable`; hard-refresh CDN (≈1h cache) and re-smoke.
