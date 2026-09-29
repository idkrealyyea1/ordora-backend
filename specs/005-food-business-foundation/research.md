# Research: Food Business Foundation

**Feature**: `specs/005-food-business-foundation/spec.md` | **Date**: 2026-09-29
All findings verified against repository source on 2026-09-29. Stale docs treated as non-authoritative per Constitution V.

## R1 — How to represent business type

- **Decision**: Single additive `restaurants.business_type TEXT NOT NULL DEFAULT 'restaurant'` with a closed CHECK of 9 values; capabilities mapped to existing fields; no new tables.
- **Rationale**: Type is an attribute of the tenant root, so every existing tenant-scoped query keeps working unchanged. Default preserves all current rows with zero backfill. CHECK enforces the clarified closed set at the lowest layer.
- **Alternatives considered**:
  - Separate tables/apps per type → rejected: violates FR-001/FR-002 and Constitution XVIII/XIX; multiplies every future fix by 9.
  - Generic JSON capabilities column → rejected: unqueryable, unconstrainable, invites per-type forks through the back door; existing typed columns already cover the core four.
  - Separate `business_types` lookup table → rejected: 9 fixed values need no join, no admin CRUD, no orphan risk; a CHECK is the simplestcorrect constraint.
  - Stuffing type into name/slug/description → rejected: corrupts identity, slugs, directory, and SEO semantics.

## R2 — Whether pre-order needs schema now

- **Decision**: No columns, no engine, no behavior change. Contract-only reserve: clients MUST ignore unknown availability fields; checkout keeps enforcing current semantics.
- **Rationale**: Spec FR-007 and user input explicitly defer the pre-order system. Unread columns are the definition of speculative schema (Constitution XIII/XVIII). The reserve keeps the roadmap open without a breaking change later.
- **Alternatives considered**:
  - `is_preorder` + `available_at` columns now → rejected: no readers/writers/validation/UX in this feature; ships dead surface that tests must then carry.
  - Separate pre-order tables → rejected: same reason at higher cost.

## R3 — What multi-currency foundation actually needs

- **Decision**: Reuse the existing per-business currency contract end to end; add only creation-time passthrough plus owner form input. No math, storage, or formatting changes.
- **Rationale**: Verified existing chain is already correct: `restaurant_settings.currency` (default USD + ISO CHECK) → validator ISO-3 rule → settings service allow-list → admin `st-cur` edit path → public view exposure → `Intl.NumberFormat` presentation-only formatting with fallback. Integer-cents math never touches currency codes. The single gap is creation (validator/service/form ignore currency), confirmed by grepping all three layers.
- **Alternatives considered**:
  - Per-order currency column → rejected: snapshots already preserve behavior; mixing currencies inside one tenant order is a non-requirement.
  - Currency conversion service → rejected: roadmap has selection, not conversion; FX rates are a whole product with no customer mandate.
  - Global platform currency → rejected: contradicts FR-006 and the existing per-business field.

## R4 — Internal naming: rename vs keep

- **Decision**: Keep all internal identifiers (`restaurants`, `menu_items`, routes, URLs, slugs). Food Business / Store / Product are product wording only.
- **Rationale**: Clarifications session decision; renames break URLs, contracts, dashboards, and stored references for zero customer value and maximum regression risk (Constitution I/III).
- **Alternatives considered**: Aliased routes/tables with dual naming → rejected: doubles every query and test for a cosmetic gain; migrate-later path stays open if a spec ever mandates it.

## R5 — Onboarding path for new types

- **Decision**: Existing platform-owner creation + public request inbox; no self-serve signup; no `restaurant_requests` schema change.
- **Rationale**: Clarifications session decision; reuses gated, tested flows (`requireOwnerOrStaff`, request lifecycle pending/contacted/approved/rejected). Desired type travels via existing notes/owner step.
- **Alternatives considered**: Self-serve signup → rejected: new abuse, validation, and provisioning surface with no mandate. Request-table type column → rejected: second migration for information the owner already sets at creation.

## R6 — Capability set boundary

- **Decision**: Core four only (menu/products, pickup/delivery, hours, availability) mapped to existing columns; bookings and analytics stay type-agnostic.
- **Rationale**: Clarifications session decision; matches evidence (bookings serve restaurants today and need no per-type fork; analytics aggregate the shared order model).
- **Alternatives considered**: Per-type booking/analytics pipelines → rejected: duplicates cost with no customer requirement.

## R7 — Index and constraint choices

- **Decision**: CHECK constraints for the closed type set (new) and currency (existing, reused). No new indexes in this feature.
- **Rationale**: Correctness constraints belong in the DB; query-path indexes belong only where a query needs them. No new filtered query ships, so a `business_type` index would be dead weight; currency never appears in WHERE clauses.
- **Alternatives considered**: Index on `business_type` preemptively → rejected: premature optimization with write overhead and no reader.
