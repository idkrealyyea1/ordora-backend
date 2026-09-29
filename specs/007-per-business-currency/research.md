# Research: Per-Business Currency (Task 3)

**Feature**: `specs/007-per-business-currency/spec.md` | **Date**: 2026-09-29
Verified against repository source on 2026-09-29.

## R1 — How creation-time context survives settings changes

- **Decision**: Snapshot `orders.currency` at checkout from the locked settings row; read tracking/analytics from the snapshot; backfill history from settings.
- **Rationale**: The live-settings join (`orders.service.js:481-484`) provably re-labels history on every settings edit. A per-order label is the smallest write that freezes context; amounts never move.
- **Alternatives considered**:
  - Keep the join and forbid currency changes after first order → rejected: contradicts FR-002 owner control.
  - Immutable settings rows (versioned currency history) → rejected: a history table for one label is over-engineering; snapshot is one column.
  - Snapshot full formatted strings → rejected: violates numeric-only storage (FR-004).

## R2 — How strict the prepared set should be

- **Decision**: UI offers the prepared eight; storage/validator stay open to any ISO-3 code.
- **Rationale**: Satisfies FR-003 (rejection of non-codes) and FR-012 (ninth code = list addition, no migration) simultaneously. A schema CHECK of eight would force a migration per currency — the opposite of the requirement.
- **Alternatives considered**:
  - DB CHECK limited to eight → rejected: model change per currency, contradicts FR-012.
  - Free-text everywhere with no list → rejected: no discoverability for owners, weak UX.

## R3 — Which actor mutates currency

- **Decision**: Business admin via settings; platform owner sets only the creation default (remove currency from the owner-update proxy).
- **Rationale**: Clarification session decision. The proxy was Task 1 scaffolding from before the actor was fixed; keeping two writers invites conflicting edits and muddies audit.
- **Alternatives considered**: Keep both writers → rejected: contradicts the clarification; dual control with no conflict policy.

## R4 — What cross-currency aggregates look like

- **Decision**: Per-currency grouped figures as additive fields; no conversion; no totals removed.
- **Rationale**: FR-009 bans unlabeled mixed totals. Grouping preserves every existing number while adding context; conversion would be an unrequested FX product.
- **Alternatives considered**: Single converted total → rejected: needs rates (out of scope), destroys auditability. Drop platform totals → rejected: removes existing behavior (Constitution I).

## R5 — Backfill safety

- **Decision**: Backfill NULL snapshots from each order's own business settings inside the additive migration; CHECK applied after backfill.
- **Rationale**: Reproduces today's display for every historical row (zero-regression proof for SC-002); constraint-first ordering would fail on legacy NULLs.
- **Alternatives considered**: Application-layer backfill script → rejected: migration-runner pattern with `schema_migrations` keeps deploy atomic and re-runnable.
