# Data Model: Owner Web Push

**Feature**: `specs/012-owner-web-push/spec.md` | **Date**: 2026-09-30

Reuses `push_subscriptions` and `notification_events` (025) unchanged except one optional additive column. Money, orders, snapshots untouched.

## Reused entities (no schema change)

- **push_subscriptions** (`id UUID PK`, `restaurant_id UUID NULL FK CASCADE`, `endpoint TEXT UNIQUE`, `p256dh TEXT`, `auth TEXT`, `is_active BOOL DEFAULT TRUE`, `created_at/updated_at`): per-device records. Ownership is ALWAYS re-derived from the subscribing session (`restaurant_id` set server-side, never from the browser); the NULL-able column stays NULL only for rows that predate this feature (none in practice — table is empty today).
- **notification_events** (`event_key UNIQUE` per channel, `state pending|delivered|failed|skipped`): push delivery outcomes reuse the same rows/states (`push` channel suffix). No new states needed: dead endpoints → row `failed` + subscription `is_active = FALSE`; disabled channel → `skipped`.
- **orders / users / restaurants**: order is the source of truth; deactivated users lose sessions via existing `attachUser` (their devices stop being manageable); restaurant delete cascades subscriptions.

## New / changed (one additive migration at most)

### `026_push_label.sql` — optional device label

- `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT ''` with `CHECK (char_length(label) <= 60)`.
- Purpose: let owners tell devices apart ("Kitchen phone"). Client-supplied, server-validated plain text (max 60), safe default, re-runnable no-op. If plan review finds the created-date display sufficient, this migration is dropped with no other change.

## Derived projections (no new tables)

- **Subscription view** (owner settings): `{id, label, created_at, is_active}` per business — never endpoint/key material beyond what's needed to delete.
- **Push payload**: `{title, body, tag: eventKey, url: '/admin.html#orders', business}` — minimal, no customer PII.
- **Delivery attempt**: the `notification_events` row for `eventKey:push` (`delivered|failed|skipped`) — inspection only.

## Relationships

`restaurants 1—* push_subscriptions` (session-derived); `orders 1—* notification_events` (logical, `SET NULL` on delete, unchanged).

## Validation rules (server-enforced)

- Endpoint: valid HTTPS URL, max 2000 chars. `p256dh`/`auth`: valid base64url, non-empty, capped lengths. `label`: plain text, max 60.
- Upsert semantics: same endpoint re-subscribed → update keys/label, reactivate, rebind to current session tenant (a device changing hands follows the new owner; old business stops receiving).
- Staff sessions: refused before any write (403). Deactivated users/businesses: existing session/authZ layers already deny.

## Migration notes

`026` (if kept): single `ADD COLUMN IF NOT EXISTS` + idempotent constraint guard, safe default `''`, re-runnable no-op; rollback = column drop, no order data affected. Never edit `025`.
