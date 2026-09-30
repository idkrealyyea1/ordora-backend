# Research: Ordering Journey (Tasks 6–8)

**Feature**: `specs/010-ordering-journey/spec.md` | **Date**: 2026-09-29
Verified against order services, validators, tracking, SSE, and tests on 2026-09-29.

## R1 — How pre-order is stored

- **Decision**: Two columns on `menu_items` (flag + message) and two snapshot columns on `order_items` (flag + message). No date fields, no new tables.
- **Rationale**: Message-only timing per clarification needs nothing more; columns ride existing tenant-scoped rows with safe defaults, so normal products are untouched and rollback is a drop.
- **Alternatives considered**:
  - Reuse `is_available = false` + note → rejected: corrupts availability semantics and would break checkout gating that refuses unavailable items.
  - Dedicated pre-order tables → rejected: a flag plus message does not justify joins, CRUD, and migration surface.
  - Date/time columns now → rejected: contradicts the message-only clarification; future task can add them additively.

## R2 — Where pre-order rules are enforced

- **Decision**: Inside the existing checkout transaction: item must still be available/active, flag on, message frozen to the line; stale claims refused pre-insert.
- **Rationale**: Same trust boundary and race safety as availability/options; no new transaction machinery.
- **Alternatives considered**: Client-side gating only → rejected: trust violation. Separate pre-order checkout path → rejected: duplicates the atomic flow for a flag.

## R3 — Whether the status model changes

- **Decision**: No change. Seven statuses, existing transition map, terminal immutability, repeat-safe updates all stand; timeline is a read-only projection with pre-order annotation.
- **Rationale**: The brief demands preservation where possible, and every lifecycle requirement (valid/invalid transitions, terminal safety, pickup/delivery handling, SSE recovery) is satisfiable on the current model.
- **Alternatives considered**: Pre-order-specific states → rejected: new states multiply transitions, dashboards, timelines, and tests for a label.

## R4 — What SSE guarantees

- **Decision**: Keep best-effort notifications; dashboards and tracking refetch authoritative state; recovery is refetch-on-reconnect (already the pattern).
- **Rationale**: Matches the hub's documented single-instance design and the spec's "never the source of truth" rule.
- **Alternatives considered**: Retained mailbox / broker → rejected: new infrastructure for a guarantee the spec explicitly declines.

## R5 — How duplication safety extends

- **Decision**: Reuse submission-key idempotency unchanged; pre-order and option lines participate automatically as part of the atomic insert.
- **Rationale**: Verified mechanism covers retries, replays, and double-clicks; no partial orders possible inside the single transaction.
- **Alternatives considered**: Separate pre-order dedupe keys → rejected: redundant with the existing key that already spans the whole order.
