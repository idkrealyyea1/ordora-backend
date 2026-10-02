# Research: Owner Web Push

**Feature**: `specs/012-owner-web-push/spec.md` | **Date**: 2026-09-30

Unknowns resolved by inspecting the working tree plus the 2026-09-30 clarification session. No NEEDS CLARIFICATION remains.

## R1: Push sending — small standard library, not hand-rolled crypto

- **Decision**: Add one small, pure-JS Web Push sending library (VAPID JWT signing + RFC8291 payload encryption) as the only new runtime dependency. Implemented 2026-09-30 as `web-push@^3.6.7` (verified: loads, exposes `generateVAPIDKeys` + `sendNotification`).
- **Rationale**: Sending push requires VAPID-signed JWTs and per-subscription content encryption; hand-rolling either is a classic reliability/security footgun and directly contradicts constitution X/XXIV. A single tiny dependency with clear value satisfies constitution XI. Node 20 has global `fetch`, so the library only needs to produce the signed, encrypted request.
- **Alternatives considered**: Hand-rolled VAPID + encryption with stdlib crypto → rejected (subtle, untestable against real push services here); full notification platform/SDK → rejected (heavy, paid-service smell, violates XII).

## R2: VAPID scope — one platform keypair (clarified)

- **Decision**: Single platform-wide keypair from `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT` contact), env-only, never committed or logged. Browsers receive only the public key via an authenticated endpoint.
- **Rationale**: User chose Option A; tenant isolation comes from per-business subscriptions + scoped fan-out, so per-tenant keys add key-management cost with no privacy gain.
- **Alternatives considered**: Per-business keys → rejected by user; hardcoded/fallback keys → rejected (secret-safety violation).

## R3: Audience — admins only, staff refused (clarified)

- **Decision**: Push subscription endpoints require an authenticated restaurant admin session; staff-role sessions get 403. Implementation: a narrow guard for push routes only — the existing `requireRestaurantAdmin` (which admits staff elsewhere) MUST NOT change behavior for other routes.
- **Rationale**: User chose Option A; matches the brief (owners/admins) and least-privilege for a wake-the-device capability.
- **Alternatives considered**: Reusing `requireRestaurantAdmin` as-is → rejected (admits staff, contradicts clarification); new role → rejected (no new roles in scope).

## R4: Public-key delivery — authenticated endpoint, not public

- **Decision**: `GET /api/admin/push-public-key` (admin session) returns `{ publicKey }` plus an `enabled` flag; absence of keys yields `enabled: false`, and settings render the unavailable state.
- **Rationale**: Keeps key distribution inside the existing session boundary; no new auth surface; unavailable-state logic lives in one place.
- **Alternatives considered**: Baked into HTML → rejected (caching/staleness, exposes key to unauthenticated crawlers unnecessarily); fully public endpoint → rejected (no benefit, wider surface).

## R5: Failure policy — record once, recover on next event (clarified)

- **Decision**: Transient send failure → mark row `failed`, no immediate retry; next order event re-attempts naturally. Authoritative dead signals (gone/invalid endpoint) → deactivate subscription immediately. No retry loops, no schedulers.
- **Rationale**: User chose Option A; matches the existing claim/dedup + retention model with zero new infrastructure.
- **Alternatives considered**: Bounded backoff retry → rejected by user; background worker/queue → rejected (new infra for a secondary channel).

## R6: Service worker — additive handlers, cache untouched

- **Decision**: Append `push` (show notification from minimal payload) and `notificationclick` (focus/open dashboard order view) handlers to `client/sw.js`; bump `CACHE` per existing convention; fetch/cache logic byte-identical.
- **Rationale**: Existing SW is offline shell for weak networks — push handlers are orthogonal event listeners; additive change is the smallest safe delta.
- **Alternatives considered**: Separate worker file → rejected (one registration via `pwa.js`, avoids scope/registration conflicts).

## R7: Payload — minimal, code + business only

- **Decision**: `{ title, body(order code + business name), tag: eventKey, url: dashboard orders view, business }`. No customer PII, no totals; size far under push-service limits.
- **Rationale**: Spec FR-202 + edge-case payload limits; tag enables the platform to collapse/replace per event if ever needed.
- **Alternatives considered**: Rich payload (items/totals) → rejected (PII + size); no payload (bare badge) → rejected (owner can't tell which business/order without opening).

## R8: Permission UX — settings card, gesture-initiated

- **Decision**: Notifications card at top of dashboard settings: benefit line, enable button (the only prompt trigger), state line (supported/granted/denied/unavailable), device list with remove buttons. Capability detection (`PushManager`, `Notification`, SW) before rendering actions.
- **Rationale**: Satisfies FR-209–FR-211 with existing card/i18n patterns; nontechnical-owner friendly in AR+EN.
- **Alternatives considered**: Auto-prompt on dashboard open → rejected (abusive, spec-forbidden); banner → rejected (noisier than the settings-card default; plan keeps the quieter option).
