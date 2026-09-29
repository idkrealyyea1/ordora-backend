# Research: Storefront UX (Task 4)

**Feature**: `specs/008-storefront-ux/spec.md` | **Date**: 2026-09-29
Verified against `restaurant.html`, `restaurant.js`, and `storefront.css` on 2026-09-29.

## R1 — Where contact information comes from

- **Decision**: Render phone/whatsapp from the already-fetched settings object; no payload change.
- **Rationale**: Fields arrive in every public view and are simply never rendered. Zero backend or contract cost.
- **Alternatives considered**: New contact endpoint → rejected: data already present; a second request hurts weak-device goals.

## R2 — How far discovery changes go

- **Decision**: Presentation tightening inside existing markup and classes; navigation, filtering, and card-action logic byte-identical in behavior.
- **Rationale**: The flows are proven (position retention, live filter, soldout gating, qty controls). Restyling structure risks cart-loss and availability regressions for no user gain.
- **Alternatives considered**: Rebuilt grid/filter components → rejected: rewrite risk with identical data; violates Constitution II/XX.

## R3 — Which accessibility fixes ship

- **Decision**: Search label, live regions on bar/totals, overlay focus move + return, focus-visible styles. Nothing else.
- **Rationale**: Each maps to a verified gap; each is additive attributes/CSS with zero behavior change when ignored by older assistive tech.
- **Alternatives considered**: Focus-trap library or ARIA dialog overhaul → rejected: new dependency and interaction risk; Escape + native controls already work.

## R4 — How performance is guaranteed

- **Decision**: No new assets, requests, or animations; verification asserts request-count and asset parity.
- **Rationale**: Weak-device usability is a requirement; the cheapest guarantee is adding nothing.
- **Alternatives considered**: Image optimization pipeline → rejected: separate concern, new tooling, out of scope.
