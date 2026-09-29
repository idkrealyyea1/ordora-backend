# Implementation Plan: Food Business Types (Task 2)

**Branch**: `006-food-business-types` | **Date**: 2026-09-29 | **Spec**: `specs/006-food-business-types/spec.md`

**Input**: Feature specification from `specs/006-food-business-types/spec.md` plus Clarifications session 2026-09-29 (dashboards-only visibility; owner-only type change).

**Note**: Task 1 (`specs/005-food-business-foundation/`, implemented in working tree) is the baseline: migration `021_business_type.sql`, validator/service/controller plumbing, owner create/edit form, creation-time currency, 4 new test files. This plan reuses all of it and adds only the Task 2 domain delta. No rewrite, no React, no renames, no new dependencies.

## Summary

Lock the Food Business domain on top of the Task 1 foundation with three minimal additions: expose read-only type in the admin dashboard payload and render it in owner/admin dashboards (customer storefronts stay badge-free), verify and lock owner-only type mutation with tests, and cover guest ordering across all six required kinds on the shared flow. No migration, no new routes, no behavior change to ordering, money, isolation, or security.

## Technical Context

**Language/Version**: Node.js >= 20, vanilla HTML/CSS/JS (no build, no TypeScript)

**Primary Dependencies**: Express 4, pg, express-session + connect-pg-simple, helmet, express-rate-limit, bcryptjs, qrcode (existing; no new dependencies)

**Storage**: PostgreSQL via `server/db/pool.js`; migrations `database/migrations/*.sql` via `database/migrate.js`. No new migration in this task (`021_business_type.sql` from Task 1 stands).

**Testing**: `node --test tests/` against explicit `TEST_DATABASE_URL` (disposable DB only) plus `npm run check` (0 failures required)

**Target Platform**: Wasmer Edge (`app.yaml`) + any Node 20 host; single-instance limits and SSE hub unchanged

**Project Type**: Web application (Express API + vanilla static frontend in `client/`)

**Performance Goals**: No new NFRs; no new queries except one added column on an already-fetched row; no N+1

**Constraints**: Additive-only changes; tenant identity from session only; type mutation owner-gated; type visible in dashboards, never badged on storefronts; integer money untouched; closed validated type set; visual identity frozen

**Scale/Scope**: Six required kinds ordering on the shared flow; sitemap bound (500) unchanged

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- I Preserve Working Functionality: PASS — additive JSON fields + dashboard cells only; ordering, URLs, data untouched.
- II/III No React / No Rebuild: PASS — reuse Task 1 plumbing; smallest diff.
- IV/V/VI Inspect, Source of Truth, No Guessing: PASS — gaps verified by grep 2026-09-29 (no storefront/admin type refs; admin settings path type-free; myRestaurant payload lacks type).
- VII/VIII Migrations: PASS — zero new migrations; 021 stands as designed.
- IX Isolation (NON-NEGOTIABLE): PASS — myRestaurant already tenant-scoped; no scoping change.
- X Security: PASS — no new inputs accepted (display-only additions); owner gate unchanged.
- XI–XIV Deps, Simplicity, No Speculation, Purpose-Gated: PASS — no deps, no abstractions, every change traces to FR-002/clarifications.
- XV–XXIII Guest checkout, no payments, one system, configurable capabilities, currency preserved, honest SEO, no fabrication, identity: PASS — all untouched.
- XXIV–XXVIII Reliability, tests, verification, flag weak, ask: PASS — locking tests added, none weakened.

Post-design re-check: PASS — no new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-food-business-types/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Same layout as Task 1 plan (routes → controllers → services → parameterized SQL; `client/` vanilla pages; `tests/` node:test). Task 2 touches only:

```text
server/controllers/admin.controller.js   # myRestaurant response += businessType (read-only)
client/js/owner.js                        # owner restaurants table: type cell (existing esc() pattern)
client/js/admin.js                        # admin overview: type readout from myRestaurant (existing pattern)
tests/domain-business-types.test.js       # NEW: six-kind ordering + dashboards-only + owner-only locks
```

**Structure Decision**: Reuse everything from Task 1. No new directories, routes, tables, or dependencies.

## Existing Inventory (verified 2026-09-29; Task 1 deltas included)

- **Schema**: `restaurants.business_type` (021, closed 9, default `restaurant`); all other tables unchanged from Task 1 baseline.
- **Plumbing**: create/update accept closed-set type + creation currency; owner list/detail/public view/directory expose read-only `businessType`; owner create/edit form has type select + currency input (`mBizType`, `currencyL` i18n keys).
- **Verified gaps driving this plan**: `admin.controller.myRestaurant` response lacks type (owner/detail have it); `admin.js`/`restaurant.js` contain zero type references (dashboards-only holds at UI layer by absence, admin display missing); admin settings validator path provably type-free (owner-only holds by construction, no locking test yet).
- **Untouched**: checkout, money, isolation, sessions, CSRF/origin, rate limits, uploads, SEO, identity, bookings, i18n engine, payments.

## Proposed Changes (each with required analysis)

### C1 — Admin dashboard payload: expose read-only type in `myRestaurant`

- **Why required**: Clarification demands type visible in admin dashboards; owner list/detail already expose it, admin's own endpoint does not.
- **Behavior affected**: One additive JSON field (`businessType`, default `restaurant`) on `GET /api/admin/restaurant`. Nothing else reads differently.
- **Migration**: None.
- **Backward compatibility**: Old clients ignore the extra field.
- **Indexes/constraints**: None (display of existing constrained column).
- **Tenant isolation**: Endpoint already scoped by `tenantId(req)` from session; field rides the tenant's own row.
- **Rollback**: Drop the field from the response mapper; zero data impact.

### C2 — Dashboard rendering: type cell (owner table) + type readout (admin)

- **Why required**: Payload exposure alone does not satisfy "visible in dashboards"; rendering follows existing `esc()` patterns in both files, no new components.
- **Behavior affected**: Owner restaurants table gains a type cell; admin overview gains a type readout from the already-fetched `myRestaurant` payload. Storefront files untouched — no badge ever rendered.
- **Migration/compat**: None / purely additive display.
- **Isolation/rollback**: Display of already-authorized data; remove cells to roll back.

### C3 — Locking tests (no production-code change)

- **Why required**: Owner-only mutation and dashboards-only visibility currently hold by construction but have no test pinning them; SC-004/SC-005 and the clarifications need executable proof. Six-kind ordering (SC-003) has fixture coverage for two kinds only.
- **Coverage**: new `tests/domain-business-types.test.js` — create + guest order for each of the six required kinds on the shared flow; admin `PATCH /api/admin/settings` carrying `businessType` leaves stored type unchanged; owner `PATCH` changes it; storefront document carries no type badge marker while owner list/detail and admin `myRestaurant` expose it.
- **Rollback**: N/A (tests only; existing suites unweakened).

### Explicit non-changes

- No migration (021 stands); no public-contract reshaping (payload `businessType` stays additive data, clients ignore it — removing it would break Task 1 tests for zero customer gain); no bookings, self-serve signup, i18n, currency, payments, renames, homepage or marketing changes.

## Risks, Edge Cases & Architectural Conflicts

- **RISK-1 — Payload vs display gap**: public menu/directory payloads keep additive `businessType` data while storefronts must never badge it. A future UI change could render it accidentally. Mitigation: dashboards-only locking test asserts no badge marker on the storefront document.
- **RISK-2 — Closed set vs future kinds**: the CHECK constraint rejects unknown types at the DB layer too, so extension strictly requires a later scoped task (validator + additive migration). No silent drift possible; documented extension path in `research.md` R4.
- **RISK-3 — Silent-ignore authorization**: owner-only mutation relies on the settings validator's explicit allowlist dropping unknown fields. Mitigation: locking test pins "admin PATCH with type leaves stored type unchanged".
- **RISK-4 — Capability without storage**: a future capability needing new stored state requires a fresh migration; the current map covers only the core four. Acceptable: no speculative columns (Constitution XIII/XVIII).
- **Edge cases**: type change on a live business mid-day (orders/users/menu/settings untouched; capability behavior follows new type for future orders only); concurrent checkouts across types (per-tenant row lock unchanged); legacy rows read as `restaurant` with pixel-identical dashboards.
- **Architectural conflicts**: none found — table names, terminology, URLs, money model, isolation, and security posture all preserved; no framework, dependency, or infra change.

## Complexity Tracking

> No constitution violations. No entries.

## Phase 0 / Phase 1 Artifacts

- `research.md` — decisions, rationale, rejected alternatives.
- `data-model.md` — domain entities on the Task 1 schema (no schema delta).
- `contracts/` — dashboard contract deltas (additive-only).
- `quickstart.md` — runnable validation guide.
