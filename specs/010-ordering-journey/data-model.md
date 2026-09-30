# Data Model: Ordering Journey (Tasks 6–8)

**Feature**: `specs/010-ordering-journey/spec.md` | **Date**: 2026-09-29
Column-only additive delta. Everything else reused from Tasks 1–5.

## New/changed fields

### Pre-Order Mark (`menu_items`)

- `is_preorder BOOLEAN NOT NULL DEFAULT FALSE`; `preorder_note TEXT NOT NULL DEFAULT ''` (length-capped, customer-facing timing message).
- Tenant-scoped CRUD like all item fields; off/empty = legacy behavior exactly.

### Order Snapshot (`order_items`)

- `is_preorder BOOLEAN NOT NULL DEFAULT FALSE`; `preorder_note TEXT NOT NULL DEFAULT ''` frozen at checkout from current definitions.
- Read by tracking, dashboards, and exports; never rewritten.

## Reused entities (unchanged shapes)

- **Cart**: guest-local lines (simple, optioned, pre-order); presentation only.
- **Order**: transactional creation with lines, option snapshots, currency snapshot, idempotency key, status lifecycle — plus pre-order snapshots.
- **Status Timeline**: read-only projection of the 7 enforced statuses with pre-order annotation; pickup/delivery variants handled.
- **Realtime Event**: best-effort notification; authoritative state always refetched.

## Validation and math (write-time, in-transaction)

- Pre-order lines: item available/active, flag on, message frozen; stale claims refused pre-insert; totals math unchanged (integer cents, server truth).
- Transitions: existing map enforced server-side; terminal states immutable; repeats safe.

## Tenancy and security

- All reads/writes filter session-derived tenant scope; explicit allowlist validators; safe errors; guest tracking by unguessable code only.
