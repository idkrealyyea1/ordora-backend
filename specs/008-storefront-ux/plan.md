# Implementation Plan: Storefront UX (Task 4)

**Branch**: `008-storefront-ux` | **Date**: 2026-09-29 | **Spec**: `specs/008-storefront-ux/spec.md`

**Input**: Feature specification from `specs/008-storefront-ux/spec.md` plus Clarifications session 2026-09-29 (search stays on every storefront).

**Note**: Presentation-only refinement of the verified vanilla storefront. No migration, no API change, no React, no new dependencies, no URL change.

## Summary

Refine the existing single-page storefront in place: complete the identity block with contact information from already-fetched settings, keep every discovery and cart flow structurally identical while tightening presentation and feedback, and close the verified accessibility gaps (search labeling, live regions for cart/totals, overlay focus management with return-focus, visible focus styles). All data already arrives in the public view payload; ordering, pricing, isolation, and security paths are untouched.

## Technical Context

**Language/Version**: Node.js >= 20 runtime; vanilla HTML/CSS/JS storefront (no build, no TypeScript)

**Primary Dependencies**: None new (existing Intl formatting, skeleton, i18n enhancement reused)

**Storage**: No change (presentation-only; zero migrations)

**Testing**: `node --test tests/` against explicit `TEST_DATABASE_URL` (disposable DB only) plus `npm run check` (0 failures); storefront behavior covered via existing API suites plus new DOM-light assertions where the suite harness allows

**Target Platform**: Mobile-first browsers on weak devices; Wasmer Edge static serving unchanged

**Project Type**: Web application (Express API + vanilla static frontend)

**Performance Goals**: No new assets, no new requests, no gratuitous animation; lazy images, skeleton/offline resilience, and existing request count preserved

**Constraints**: Restivo visual identity frozen (refine within system); Arabic RTL + English both correct; keyboard/touch operable; guest checkout default; Task 3 currency presentation untouched; search on every storefront

**Scale/Scope**: One page (`restaurant.html` + `restaurant.js` + `storefront.css`); all business types share it

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- I Preserve Working Functionality: PASS — renderer structure, URLs, payloads, checkout, WhatsApp path, booking entry, share, skeleton all preserved.
- II/III No React / No Rebuild: PASS — targeted edits inside existing render functions and stylesheet.
- IV/V/VI Inspect, Source of Truth, No Guessing: PASS — gaps verified in `restaurant.js`/`storefront.css` 2026-09-29 (contact absent, search unlabeled, no live regions, no focus management).
- VII/VIII Migrations: PASS — none.
- IX Isolation: PASS — no data-access change.
- X Security: PASS — no new inputs (search exists; labels/regions/focus are non-input attributes); escaping pattern reused.
- XI–XIV Deps, Simplicity, No Speculation, Purpose-Gated: PASS — no deps, no components, every edit traces to an FR.
- XV–XXIII CX simplicity, guest checkout, no payments, one system, currency, honest data, identity: PASS — all preserved or directly served.
- XXIV–XXVIII Reliability, tests, verification, flag weak, ask: PASS — suites extended, none weakened; `npm run check` gate stands.

Post-design re-check: PASS — no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-storefront-ux/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Task 4 touches only:

```text
client/restaurant.html            # minor: labelled search hook, live-region hooks (no visual change)
client/js/restaurant.js           # renderHead/renderContent/dishCard/renderBar/renderOverlay refinements
client/css/storefront.css         # focus-visible styles + identity/contact polish within system
tests/storefront-*.test.js        # NEW: API-backed presentation guarantees (see contracts/)
```

**Structure Decision**: Existing files extended in place. No new pages, components, routes, stylesheets, or dependencies.

## Existing Inventory (verified 2026-09-29)

- **Shell**: `restaurant.html` (52 lines) — skeleton, offline/retry, live header/content/cart/overlay mounts.
- **Renderer**: `restaurant.js` (523 lines) — `renderHead` (brand, logo/letter, language toggle), `renderContent` (hero with status/description/address/delivery-groups, category nav, search, `updateGrids` with featured/popular sections and empty states, `dishCard` with soldout-tag vs add/qty controls, currency via `money()`), `renderBar` (cart pill), `renderOverlay` (cart rows, pickup/delivery toggle, totals, checkout form, WhatsApp + site submit, success/tracking), booking modal, share, localStorage cart/order-type, Escape-to-close.
- **Verified gaps**: contact phone/whatsapp never rendered though fetched; search input placeholder-only (no label); no `aria-live` on bar/totals; no focus move/return for overlay; no `:focus-visible` system in `storefront.css`.
- **Verified strengths (reuse)**: soldout items render no add control; server re-validates availability/prices/hours at checkout; lazy images; skeleton/offline; RTL+English dictionaries; `esc()` everywhere.

## Proposed Changes

### C1 — Identity block: contact row from fetched settings (FR-001)

- **Why**: Phone/whatsapp are fetched but never shown; identity requires location/contact where available.
- **Change**: Render phone/whatsapp links in the hero meta row when set, using existing `esc()` + meta styling; omit cleanly when absent. No payload, style-system, or behavior change.
- **Rollback**: Remove the row.

### C2 — Discovery polish without flow change (FR-002/FR-003/FR-004)

- **Why**: Clarify navigation and cards while keeping positions, cart, and search semantics identical.
- **Change**: Active-category affordance and empty-state copy within existing classes; card availability/price hierarchy tightened in existing markup; search keeps input behavior plus an accessible label (see C4). No new sections, no reordering logic change.
- **Rollback**: Revert markup strings.

### C3 — Cart clarity (FR-005/FR-006/FR-007)

- **Why**: Total-cost confidence; structure already correct, feedback needs tightening.
- **Change**: Keep bar/overlay/form/toggle/submit logic identical; ensure totals (subtotal/fee/total in business currency) render on every overlay state including empty-cart and closed-business states; keep WhatsApp + site paths and tracking-code success untouched.
- **Rollback**: Revert strings.

### C4 — Accessibility closure (FR-010)

- **Why**: Verified gaps: unlabeled search, silent cart/total updates, unmanaged overlay focus, missing focus-visible system.
- **Change**: `aria-label` on search (both languages via existing dictionaries); `aria-live="polite"` on cart bar and overlay total; move focus into the modal on open and return it to the invoking control on close; `:focus-visible` styles inside `storefront.css` reusing brand tokens. Native buttons/inputs otherwise unchanged.
- **Rollback**: Remove attributes/styles; behavior identical without them.

### C5 — Performance guardrails (FR-011)

- **Why**: Weak-device usability is a requirement, not an assumption.
- **Change**: None additive — assert no new assets/requests/animations; keep lazy loading, skeleton, and offline/retry paths byte-identical in behavior.
- **Rollback**: N/A.

### Explicit non-changes

- No API, migration, URL, checkout-logic, pricing, isolation, or security change; no variants, pre-orders, accounts, loyalty, reviews, booking-logic change, or i18n framework; no new dependencies, animations, or pages.

## Complexity Tracking

> No constitution violations. No entries.

## Phase 0 / Phase 1 Artifacts

- `research.md` — decisions, rationale, rejected alternatives.
- `data-model.md` — presentation entities (no schema).
- `contracts/` — storefront presentation contract (no API change).
- `quickstart.md` — runnable validation guide.
