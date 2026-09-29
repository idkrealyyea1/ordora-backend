# Research: Food Business Types (Task 2)

**Feature**: `specs/006-food-business-types/spec.md` | **Date**: 2026-09-29
Findings verified against repository source (including Task 1 working-tree deltas) on 2026-09-29.

## R1 — Where dashboard visibility is missing

- **Decision**: Add read-only `businessType` to admin `myRestaurant` plus minimal dashboard rendering (owner table cell, admin readout); leave public payloads and storefront rendering untouched.
- **Rationale**: Grep evidence: owner list/detail already expose the field; `myRestaurant` does not; neither `admin.js` nor `restaurant.js` references type anywhere, so dashboards-only holds at the UI layer by absence and only the admin readout is missing.
- **Alternatives considered**:
  - Strip `businessType` from public menu/directory payloads → rejected: breaks Task 1 additive contract and its tests for zero customer-visible gain; payload data ignored by clients is not "visibility".
  - Full dashboard redesign around types → rejected: out of scope; two cells/readouts satisfy the clarification.

## R2 — How owner-only mutation is proven

- **Decision**: No production-code change; the admin settings validator path is provably type-free (explicit allowlist object), so a locking test suffices.
- **Rationale**: Absence verified by grep across `validators/index.js` and `admin.controller.js`. A test pinning "admin PATCH with businessType leaves type unchanged" converts construction fact into regression proof at near-zero cost.
- **Alternatives considered**: Server-side explicit rejection (400 on unknown settings fields) → rejected: would change long-standing mass-assignment-tolerant behavior and break the pre-order reserve contract from Task 1.

## R3 — Whether a new migration is needed

- **Decision**: None. Migration `021_business_type.sql` already stores the persistent constrained type with safe defaults and reversibility.
- **Rationale**: Task 2 adds no stored attributes — visibility is display, owner-only is authorization, six-kind coverage is tests. A migration with no columns would be ceremony.
- **Alternatives considered**: Per-type settings table → rejected: speculative duplication contradicting FR-005 and Constitution XIX.

## R4 — What "extendable later" means concretely

- **Decision**: Extension = admitting a new validated value through a later scoped task (validator set + CHECK, additive migration); never code forks or parallel flows.
- **Rationale**: Matches the spec assumption and the Task 1 clarification (closed set; new types need spec + migration). Keeps the anti-fork guarantee executable.
- **Alternatives considered**: Open text type → rejected: loses validation, invites per-type string-matching branches, voids SC-005.
