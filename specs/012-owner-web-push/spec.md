# Feature Specification: Owner Web Push

**Feature Branch**: `012-owner-web-push`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Real end-to-end browser Web Push for business owners/admins on new customer orders, working together with (never replacing) the existing dashboard SSE realtime notification. VAPID via env, tenant-isolated subscriptions in PostgreSQL, duplicate prevention, expired-subscription cleanup, multi-device, permission UX on user gesture, service-worker receive/display/click, push failure never breaks orders. Out of scope: SMS/email/WhatsApp/marketing/customer push/accounts/payments/drivers/GPS."

**Scope**: This spec covers owner/admin NEW-ORDER push only. Tasks 9–12 (confirmation/tracking, operations board, notification foundation with persisted dedup, analytics) are EXISTING and must be preserved and extended, never rebuilt. The existing SSE dashboard path stays exactly as the in-dashboard channel.

## Clarifications

### Session 2026-09-30

- Q: Should the whole platform share one VAPID keypair for Web Push, or should each food business get its own keypair? → A: Single platform-wide VAPID keypair shared by all businesses (Option A).
- Q: Who should be allowed to subscribe to and receive a business's new-order push notifications? → A: Restaurant admins only; staff-role users excluded; platform-owner path unchanged (Option A).
- Q: When a push send fails temporarily, how should the system handle the retry? → A: No immediate retry; record failure and recover on the next order event (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner receives browser push for a new order with dashboard closed (Priority: P1) 🎯 MVP

A restaurant owner has granted notification permission on their phone. The dashboard is closed and the browser is in the background. A guest places an order. Within roughly half a minute, the owner's device shows a system notification ("New order received" plus the order code and business name). Tapping it opens the dashboard order view. The order itself was never at risk: had push failed, checkout still succeeds and the dashboard SSE path still works when opened.

**Why this priority**: This is the entire feature — reaching owners who are not staring at the dashboard (kitchen, deliveries, off-hours). Without it, nothing new ships.

**Independent Test**: On a supported browser, enable notifications from the dashboard settings, close the tab, place a guest order from another device, and observe the system notification; tap it and land on the order.

**Acceptance Scenarios**:

1. **Given** an owner with an active push subscription and granted permission, **When** a guest order commits successfully, **Then** a browser/device notification is delivered showing "new order" meaning, the order code, and the business name — without opening the dashboard.
2. **Given** a delivered push notification, **When** the owner taps/clicks it, **Then** the dashboard (order view for that business) opens or focuses.
3. **Given** push delivery fails for any reason (no keys configured, network error, push service rejects), **When** a guest checks out or an order status changes, **Then** the order operation still fully succeeds and the dashboard realtime channel is unaffected.
4. **Given** two devices subscribed for the same business, **When** a new order arrives, **Then** both devices receive the notification (one per subscription, no duplicates per subscription).

---

### User Story 2 - Owner manages notification permission and subscriptions (Priority: P1)

A nontechnical owner opens dashboard settings and finds a clear notifications section explaining why order alerts are useful, with a single control to enable them. Enabling triggers the browser permission prompt as a direct result of their tap (never on page load). They can see how many devices are subscribed and remove one (e.g. an old phone). Denying permission shows a plain explanation, not an error loop.

**Why this priority**: Without understandable opt-in, P1 adoption is zero; without control, lost/stale devices become spam or confusion. Equally blocking as delivery itself.

**Independent Test**: As owner, open settings, enable notifications, confirm the browser prompt appears from the tap, verify a subscription is stored; deny on a second profile and confirm graceful messaging; remove a device and confirm it stops receiving pushes.

**Acceptance Scenarios**:

1. **Given** an owner viewing dashboard settings, **When** they look for notifications, **Then** a dedicated section explains the benefit and offers an explicit enable control — no permission prompt appears before they act.
2. **Given** the owner taps enable, **When** the browser asks for permission, **Then** granting stores a subscription bound to their business and denying shows a calm explanation with how to re-enable later in browser settings.
3. **Given** subscribed devices, **When** the owner opens the notifications section, **Then** they can see their subscribed devices (labelled plainly, e.g. by creation time/browser where available) and remove any of them.
4. **Given** a removed or revoked subscription, **When** a new order arrives, **Then** no push is attempted to it and no error surfaces to the owner or the customer.

---

### User Story 3 - Both channels work together without duplication or leakage (Priority: P2)

An owner has the dashboard open on a laptop and push enabled on a phone. A guest orders. The laptop shows the existing SSE visual highlight (unchanged behavior); the phone gets a push. Replaying the same order event never produces a second push to the same device. A second business's owner never sees anything about the first business's order through either channel.

**Why this priority**: P2 because each channel works alone, but the dual-channel contract (no duplicates, no leaks, SSE preserved) is what makes the feature shippable rather than annoying or unsafe.

**Independent Test**: With dashboard open plus a subscribed device, place one order, replay its event, and inspect both surfaces plus a second business's surfaces.

**Acceptance Scenarios**:

1. **Given** the dashboard open and push subscribed, **When** a new order arrives, **Then** the SSE visual indicator behaves exactly as before (highlight, pending badge, ordering) AND the push is delivered — neither channel degrades the other.
2. **Given** the same order event processed twice (retry, replay, double emit), **When** delivery runs, **Then** each subscription receives at most one push for that event (existing claim/dedup foundation reused).
3. **Given** two businesses, **When** business A gets an order, **Then** business B receives nothing on SSE or push, and guest tracking for the order is unchanged.
4. **Given** an expired, revoked, or invalid subscription endpoint, **When** delivery is attempted, **Then** the subscription is deactivated/removed safely, the failure is recorded, and the order plus all other subscriptions are unaffected.

---

### Edge Cases

- Browser without push support (older browsers, some iOS versions/modes): enable control explains unavailability instead of failing; SSE dashboard path unaffected.
- Permission already denied at browser level: settings show how to re-enable in browser settings; no repeated prompting.
- Private/incognito session subscription: stored like any other; naturally expires when the profile does; cleanup handles it.
- Subscription endpoint changes (browser refresh): re-subscribing the same device updates rather than duplicates the stored record.
- Push service rejects with gone/invalid (410/404): subscription deactivated on first such signal; no retries to dead endpoints.
- Transient push failure (5xx, network): recorded as failed with no immediate retry; delivery recovers on the next order event (clarified 2026-09-30); the order is intact and there is never a retry loop.
- VAPID keys missing/misconfigured in an environment: push channel stays disabled exactly as today; checkout, SSE, and settings all work; settings show push as unavailable with admin guidance (never a stack trace).
- Owner account deactivated or business removed: subscriptions for it stop receiving pushes (cascade or deactivation via existing user/restaurant lifecycle).
- Multiple admins of one business: each admin's devices receive the push (subscriptions are per-device, scoped to the business). Staff-role sessions cannot subscribe and receive nothing.
- Notification tapped when dashboard already open on the order: focuses the existing view rather than opening duplicate tabs where the platform allows.
- Payload size limits of push services: payload stays minimal (title/body/code/business); anything larger is never attempted.
- Checkout during push outage: order succeeds, SSE fires, push rows marked failed/skipped for later inspection.

## Requirements *(mandatory)*

### Functional Requirements

**Push trigger and content (extends Tasks 9–12 `order.created` event)**

- **FR-201**: On every successfully committed guest order, the system MUST fan out to the push channel exactly like the existing dashboard channel: one domain event, tenant-scoped, after commit, never inside the order transaction.
- **FR-202**: Push content MUST be minimal: a "new order received" title, the order code, and the business name. It MUST NOT include customer name, phone/WhatsApp, address, notes, or totals.
- **FR-203**: Only the `order.created` event MUST trigger owner push. Status changes MUST continue through SSE + guest tracking only (no push on status change), keeping push volume to one per order and preventing alert fatigue.
- **FR-204**: Tapping the notification MUST open or focus the dashboard order view for the owning business (deep link to the orders surface).

**Subscription lifecycle (new, bound to existing auth)**

- **FR-205**: Storing a subscription MUST require an authenticated restaurant admin session (staff-role sessions MUST be refused; platform-owner explicit path unchanged); the business binding MUST come server-side from the session's tenant (never from a browser-supplied business/owner id) (audience clarified 2026-09-30).
- **FR-206**: Subscribing the same endpoint twice MUST update (not duplicate) the stored record; unsubscribing or removing a device MUST stop pushes to it.
- **FR-207**: The system MUST support many concurrent subscriptions per business (multi-device, multi-admin) and deliver to each independently.
- **FR-208**: Delivery rejection indicating a dead endpoint (gone/invalid) MUST deactivate or remove that subscription on first signal; transient failures MUST be recorded without retry storms; push failure MUST never affect orders, SSE, or other subscriptions.

**Permission UX (dashboard settings)**

- **FR-209**: The permission prompt MUST be triggered only by an explicit owner action in a dedicated dashboard notifications section that explains the benefit first. The page MUST never auto-prompt on load.
- **FR-210**: The section MUST show subscription state (supported/unsupported, granted/denied, subscribed devices in plain language) and MUST let the owner remove a device.
- **FR-211**: Denied or unsupported states MUST show calm guidance (how to re-enable, or that dashboard alerts still work), never error loops or dead buttons.

**Dashboard coexistence (preserve Tasks 9–12)**

- **FR-212**: The existing SSE path (`order:new` visual highlight, pending badge, ordering, reconnect reconcile) MUST behave identically with push enabled, disabled, or broken. No SSE logic may be moved, weakened, or duplicated.
- **FR-213**: Duplicate suppression MUST reuse the existing persisted claim/dedup mechanism (one visible push per event per subscription), extended to cover the push channel rather than reinvented.

### Key Entities

- **Push subscription**: a per-device record (endpoint, keys, owning business from session, active flag). Many per business; independently deliverable and revocable.
- **Push delivery attempt**: the per-subscription outcome of one event (delivered/failed/skipped/deactivated), recorded for inspection without customer data.
- **Owner notification**: the device-rendered message (title "new order", order code, business name) plus its tap target (dashboard order view).
- **VAPID configuration**: one platform-wide environment-held keypair identity shared by all businesses (clarified 2026-09-30; tenant isolation comes from per-business subscriptions and fan-out, not per-tenant keys). Public key to browsers, private key server-only.

### Data requirements

- Reuse the existing `push_subscriptions` table shape (endpoint unique, keys, business link, active flag); any needed columns (e.g. device label, owner link) MUST arrive via an idempotent additive migration with safe defaults, preserving existing rows (empty today).
- Subscription writes MUST be tenant-scoped and authenticated; endpoint deduplication is global (one row per endpoint) with ownership always re-derived from the current session.
- Delivery attempts MUST reuse the existing `notification_events` per-channel rows (extend states to cover push outcomes) rather than creating a parallel log.
- No customer PII in push payloads or in delivery-attempt diagnostics beyond the order code.

### Security requirements

- Tenant isolation is non-negotiable: subscription store/list/delete scoped to the session business; fan-out queries scoped by `restaurant_id`; a business never receives another's pushes (verified by test).
- VAPID private key server-only, from environment, never logged, never sent to browsers, never committed. Only the public key is exposed (to subscribed browsers for subscription creation).
- Subscription endpoints MUST be authenticated (`requireRestaurantAdmin` or equivalent), input-validated (endpoint URL, key formats, sizes), and rate-limited consistent with existing mutating endpoints.
- Preserve existing authN/Z, CSRF/origin guards, rate limits, parameterized SQL, and error envelopes; push errors MUST NOT leak keys, endpoints, or customer data.

### Reliability requirements

- Push is a secondary channel: checkout, status updates, and their transactions MUST succeed with push fully broken (no keys, push service down, all endpoints dead).
- Emit path MUST stay non-throwing (existing `emit()` contract); push send failures are recorded per subscription and contained.
- Dead endpoints deactivate on first authoritative signal; transient failures are recorded once with no immediate retry (recovery on next event); no unbounded loops, no polling storms.
- The order record remains the source of truth; dashboard SSE remains the primary in-dashboard signal; push never substitutes for either.

### Performance requirements

- Fan-out MUST query only the owning business's active subscriptions (indexed lookup, no table scans, no N+1 per subscription beyond the send itself).
- Sends to a business's devices run concurrently with a bounded concurrency cap; one slow/dead endpoint MUST NOT delay others.
- No new polling; no impact on checkout latency (emit stays after-commit and non-blocking); SSE cadence unchanged.

### Migration requirements

- All schema change via `database/migrations/*.sql` + `database/migrate.js` idempotent pattern; re-runnable no-op; backward compatible; history untouched.
- If the existing `push_subscriptions` shape suffices, no migration is needed beyond what exists; any addition is a new numbered migration, never an edit of `025`.
- Rollback is drop-table/if-exists or column-drop notes that touch no order data.

### Testing requirements

- Extend `tests/` in place: subscription create/update/delete; auth required; cross-tenant store/read/deny; multi-device fan-out (one push per subscription); replay dedup (one visible push per event per subscription); dead-endpoint deactivation; push-down checkout still 201; SSE `order:new` still fires with push enabled and broken.
- Push-service calls MUST be stubbed at the sender boundary in tests (no real network, no real VAPID); crypto/key handling covered by the smallest runnable check, not live credentials.
- `npm run check` 0 failures; `node --test tests/` on disposable `TEST_DATABASE_URL`; manual production checklist in quickstart (real browser, real keys, closed-tab delivery, tap-through, denied-permission path, multi-device, dead-endpoint cleanup).
- Never weaken existing tests (especially `notifications-foundation`, `operations-board`, tenant-isolation suites).

### Acceptance criteria

- **AC-1** Closed-tab order → system notification with new-order meaning + code + business name within ~30s on a supported browser; tap opens the dashboard order view.
- **AC-2** Settings enable flow: benefit explanation → user tap → browser prompt → granted stores subscription / denied shows guidance; devices listed and removable.
- **AC-3** Dashboard open + push on: SSE visual behavior byte-identical to today; replayed event yields zero duplicate pushes; second business receives nothing anywhere.
- **AC-4** Dead endpoint: first authoritative rejection deactivates it; subsequent orders skip it silently; everything else delivered.
- **AC-5** Push fully disabled/broken: checkout 201s, SSE fires, settings show unavailable-with-guidance; zero errors to customers.
- **AC-6** Full suite green on disposable DB, `check` 0 failures, AR+EN settings strings present, production checklist executed against real keys.

### Explicit out-of-scope

SMS, email, WhatsApp, marketing/promotional messaging, customer-facing push, customer accounts, online payments, driver/fleet/GPS/routeuestos, status-change pushes, inventory, bookings changes, React migration, new framework, marketing pages. No parallel notification system: everything plugs into the Tasks 9–12 abstraction.

### Dependencies on Tasks 1–8 and 9–12

- Tasks 1–8: guest checkout, 7-status lifecycle, currency snapshots, options snapshots, tenant isolation, server-side money — untouched foundations.
- Task 9–12 notification foundation (binding): `notifications.service.js` (`emit`, claim/dedup, `notification_events`, `push_subscriptions` shape, `PUSH_ENABLED` gate), SSE hub + dashboard highlight, `validateCheckout`/status validators, `tests/notifications-foundation.test.js` patterns. This feature activates the `push` channel and adds subscription + worker + settings surfaces around it.

### Risks and edge cases

- iOS/Safari push support gaps → capability detection + honest unavailable messaging (edge cases section).
- VAPID key rotation invalidating subscriptions → documented rotation runbook (re-subscribe prompt) rather than silent death.
- Permission fatigue/denial → ask-once UX, settings-based re-entry, SSE remains.
- Push-service payload limits → minimal payload enforced and tested.
- Multi-admin multi-device fan-out cost → bounded concurrency, indexed per-business lookup.
- Secret leakage → env-only keys, no logging, no client exposure, no commits (test with placeholder keys only).

### Compatibility requirements

- Preserved: all `/api/*` shapes (additive subscription endpoints only), SSE event names/payloads, tracking/checkout flows, auth/session/CSP/origin/rate-limit behavior, tenant semantics, `app.yaml` deploy contract, existing service worker caching behavior (push/click handlers additive; cache version bumped per existing convention).
- Additive only: no breaking route/payload changes; no migration rewriting history; no framework/build/TypeScript; no new runtime service.

## Success Criteria *(mandatory)*

- **SC-1**: An owner with a subscribed phone and closed dashboard learns about a new guest order from the device notification within 30 seconds of checkout, and tapping it opens the right dashboard order view.
- **SC-2**: 10 of 10 test orders with the dashboard open show the unchanged SSE visual highlight, and 10 of 10 closed-tab orders produce exactly one push per subscribed device with zero duplicates on event replay.
- **SC-3**: 100% of checkouts succeed with push fully disabled or the push service unreachable, with failures recorded and no customer-visible errors.
- **SC-4**: Zero cross-tenant deliveries across subscription, fan-out, and SSE paths in adversarial tests (spoofed business ids, swapped sessions, second-business observers).
- **SC-5**: A first-time owner enables notifications from settings without help, in Arabic or English, understanding what they consented to (measured by task-completion walkthrough, not analytics).

## Assumptions

- Tasks 9–12 tree (services, SSE hub, tables, validators, tests) is the source of truth; docs are advisory on conflict.
- Standard Web Push protocol (VAPID-keyed, push-service mediated) is the delivery mechanism; the exact sending library is a plan-time choice under constitution XI (prefer the smallest credible option).
- VAPID keys can be generated offline and provisioned per environment; production verification needs a real device/browser and cannot be fully proven in CI.
- A standard `mailto:`-style contact identity for VAPID is provisioned via environment alongside the keys.
- Existing session auth covers subscription endpoints (no new auth system); platform-owner explicit path unchanged.
- Arabic remains default RTL with English toggle via existing dictionaries; every new string ships in both.
