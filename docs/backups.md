# Backups & Recovery — Restivo (Task 17, FR-017)

> Status: procedure documented from the deployment guide and `app.yaml` reality.
> A backup that has never been restored is NOT verified — the rehearsal log
> below must carry a real date + outcome before this page claims protection.

## What is backed up

| Item | How | Frequency | Retention |
|------|-----|-----------|-----------|
| Full managed PostgreSQL (all tables incl. `uploaded_files` image bytes, sessions, subscriptions, orders) | Wasmer automatic database backups | Automatic | 14 days (per DEPLOYMENT.md; re-confirm in dashboard → Databases at rehearsal time) |
| Operator safety copy (optional, recommended before risky ops) | `pg_dump` with the `DB_*` credentials from `wasmer app database list --with-password` | Before migrations that touch orders/subscriptions, plus weekly | Operator storage, keep 4 most recent |

## Restore procedure (managed backup)

1. Dashboard → app → **Databases** tab → select backup → restore (creates a restored instance; never overwrites live blindly).
2. Point a staging copy of the app at the restored instance (`DATABASE_URL` / `DB_*`).
3. Verify: business count, menu item count, latest order code, subscription states, one image fetch per `logos|covers|items`.
4. Only then promote connection details to production.

## Restore procedure (operator `pg_dump` copy, disposable database)

```bash
pg_dump "$DATABASE_URL" -Fc -f restivo-backup.dump
pg_restore -d <disposable-pg-url> --clean restivo-backup.dump
TEST_DATABASE_URL=<disposable-pg-url> node --test tests/tenant-isolation.test.js
```

## Migration compatibility

- Migrations are idempotent via `schema_migrations` (`database/migrate.js`); restoring an older dump then booting the app re-applies only missing files in filename order.
- Never restore a *newer* schema dump onto an older codebase — deploy the matching code first.

## Rehearsal log

| Date | Target (non-production) | Result | Operator |
|------|-------------------------|--------|----------|
| 2026-10-03 | disposable Postgres 17 in Docker (`rehearsal_src` → `pg_dump -Fc` → `pg_restore` → `rehearsal_dst`) | PASS, clean restore with zero errors; recovered restaurants=2, menu_items=2, orders=3, subscriptions=2 | opencode session |
