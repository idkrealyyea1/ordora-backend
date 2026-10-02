# Feature Specification: Post-Order Experience Insights

**Feature Branch**: `011-post-order-experience-insights`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Tasks 9, 10, 11, and 12 as ONE coherent phase on top of completed Tasks 1–8: Task 9 customer post-order experience, Task 10 business owner order operations, Task 11 notifications foundation, Task 12 analytics & business insights. Preserve one shared platform, guest checkout, no payment gateways, no React migration."

**Scope**: This spec covers Tasks 9–12 ONLY. Tasks 1–8 (business-type foundation, currency, storefront UX, options/variants, pre-order + checkout + lifecycle) are EXISTING and must be preserved and extended, never rebuilt.

## Clarifications

### Session 2026-09-30

- Q: Should guest order tracking receive live status updates through a new guest-safe realtime channel, or stay on improved polling only? → A: Stay polling-only for guests (Option B).
- Q: Should this phase ship working browser Web Push notifications, or build only the Web Push-ready foundation with setup docs? → A: Foundation plus setup docs, no live push (Option B).
- Q: Should notification events be recorded in the database for dedup and catch-up, or kept transient in memory only? → A: Persist minimal per-event notification records with retention cleanup (Option A).
- Q: Should analytics offer only fixed presets, or also a custom date range? → A: Presets plus a custom date range picker (Option B).
- Q: How should a new order grab the owner's attention on the open dashboard? → A: Prominent visual signal only, no sound (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guest order confirmation and tracking (Task 9) (Priority: P1)

A guest customer (no account) places a pickup, delivery, normal, or pre-order from a food business storefront and needs to know: was my order received, what did I order, what happens next, and where is it now.

The existing confirmation view (order code + total + track link in `restaurant.js`) and the existing tracking page (`track.html`/`track.js`: code lookup, status badge, pickup/delivery timeline, items with options/pre-order notes, cancel + reorder links, 15-second polling) already work and MUST be improved in place, not duplicated. Gaps to close: confirmation does not show a full summary (type, timing, pre-order note, next steps); tracking polling needs smarter cadence, visibility handling, and offline states (no guest realtime channel — clarified 2026-09-30); reorder passes only `menu_item_id:quantity` and drops option selections; error states are generic.

**Why this priority**: This is the customer trust moment. A confusing post-order minute generates WhatsApp/phone load for nontechnical owners and lost orders. P1 because it touches revenue directly.

**Independent Test**: Place a mixed cart (normal + pre-order item with options, delivery) as guest, land on confirmation, follow the track link on a phone, watch status advance from `pending` to `preparing`, then reorder from the tracking page. No login at any step.

**Acceptance Scenarios**:

1. **Given** a guest just completed checkout successfully, **When** the confirmation renders, **Then** it shows the order code, pickup/delivery type, item lines with quantities and selected options/variants, subtotal, delivery fee, total in the business currency, any pre-order message, relevant timing, and exactly what to do next (keep code / track link).
2. **Given** a guest opens tracking with a valid code (typed, deep-linked `/track?code=XXXX`, or from confirmation), **When** the order loads, **Then** current status, a simple progress timeline matching the order kind (5-step pickup flow, 6-step delivery flow, pre-order visibly flagged, cancelled shown as terminal), and the frozen order summary are shown without requiring an account.
3. **Given** an order status changes while the guest watches tracking, **When** the change occurs, **Then** the guest sees it via improved polling (visibility-aware cadence, manual refresh, offline/reconnect states); no guest realtime channel is built; polling never corrupts or loses the order.
4. **Given** a guest taps reorder from confirmation or tracking, **When** the storefront reopens, **Then** the cart is prefilled from current menu definitions (only available items, current prices, current valid option groups/choices); unavailable or changed items are reported plainly instead of silently recreating stale prices/options.
5. **Given** an invalid, cancelled, unavailable, or mistyped code, or a network interruption, or an unavailable restaurant, **When** tracking is attempted, **Then** a plain-language message explains the state and next step without exposing other customers' data, internal IDs, or system internals.

---

### User Story 2 - Owner order operations dashboard (Task 10) (Priority: P1)

A nontechnical food-business owner/admin opens the owner dashboard on a phone during service and must instantly see new/pending orders, act on them, and never confuse pickup with delivery or pre-order with immediate orders.

The existing dashboard (`admin.html`/`admin.js`: pending list, orders tab with status filter + pagination, `NEXT_ACTIONS` per status, `PATCH /orders/:id/status`, SSE `order:new`/`order:status` refresh, order detail with items/options/notes/totals) already works and MUST be sharpened in place. Gaps to close: new arrivals are not disruptive enough during busy service; pickup vs delivery and pre-order vs normal are readable but not visually obvious at a glance; prioritization (new/pending → action-needed → today) is implicit.

**Why this priority**: Operational errors (missed order, wrong address, wrong status) cost real food and real customers. Clarity beats control count for this user.

**Independent Test**: With two pending orders (one delivery with address, one pre-order), one preparing order, and history from yesterday: open the dashboard, spot the new orders immediately, advance one status forward, attempt an invalid jump and a double-submit, and review yesterday's frozen snapshot.

**Acceptance Scenarios**:

1. **Given** a new guest order arrives while the dashboard is open, **When** it is created, **Then** it is highly visible within seconds (existing realtime event preserved and made more prominent) showing customer name, phone/WhatsApp, order type, items with variants/modifiers/quantities, notes, subtotal, delivery fee, total with currency, pre-order flag with timing note, and date/time.
2. **Given** an order list containing pickup and delivery orders, **When** the owner scans it, **Then** pickup vs delivery is visually obvious; delivery orders always show the full delivery address; pickup orders never show delivery-address fields.
3. **Given** a pre-order exists alongside normal orders, **When** the owner views any list or detail, **Then** the pre-order is visually distinct and communicates it is not an immediate order (preparation/availability timing shown from the frozen snapshot).
4. **Given** an order in any non-terminal state, **When** the owner changes status, **Then** only the valid next transitions from the existing lifecycle are offered; invalid jumps are refused; repeated/duplicate requests leave state uncorrupted (idempotent same-status, single transition).
5. **Given** past orders, **When** the owner opens history, **Then** historical prices, currency, selected variants/options, fees, and totals render exactly as frozen at purchase, unaffected by later menu edits.

---

### User Story 3 - Notification foundation (Task 11) (Priority: P2)

The platform needs one clean internal notification path so order events (new order, status change) reach the right party through the right channel without ever endangering the order itself.

Today notifications are: dashboard SSE (`order:new`, `order:status`, `booking:status` via in-process hub in `server/middleware/sse.js`, `GET /api/admin/events`) plus `wa.me` deep-links composed on the client. There is no persistent notification store (a prior persistent attempt was reverted), no guest push channel, and order logic calls the SSE hub directly. The task creates the abstraction and hardens the existing channels; it does not buy or require paid email/SMS.

**Why this priority**: P2 because ordering works without it, but missed new-order alerts are the top operational risk during service. Foundation first, channels second.

**Independent Test**: Disconnect the dashboard client, place an order, change its status twice (including a duplicate event), reconnect, and confirm: the order and both transitions persisted correctly, the dashboard caught up without duplicates, and no checkout or status call ever failed because of a notification problem.

**Acceptance Scenarios**:

1. **Given** a new order is created, **When** the transaction commits, **Then** the owning business's dashboard/staff surface receives a clear notification through the existing realtime path (preserved, more reliable), and no other business sees anything.
2. **Given** an order status changes, **When** the change commits, **Then** the guest tracking experience reflects it via improved polling and the dashboard reflects it via realtime, without duplicate alerts for a single event.
3. **Given** any notification channel is down, slow, or disconnected (dashboard closed, SSE dropped, push unavailable), **When** checkout or a status update runs, **Then** the order operation still succeeds; the notification is skipped/queued/retried per policy and the failure is diagnosable without leaking customer data.
4. **Given** a future channel (Web Push now; email/SMS later), **When** it is added, **Then** no order-write code needs rewriting: the new channel plugs into the notification abstraction with its own subscription/config, tenant scoping, and failure policy.

---

### User Story 4 - Business insights from real orders (Task 12) (Priority: P2)

A nontechnical owner wants to answer "how is my business doing?" from real orders: totals, revenue, what sells, when it sells, pickup vs delivery — without BI jargon or decorative charts.

The existing analytics (`GET /api/admin/dashboard`, `GET /api/admin/analytics?days=1–90` with series/topItems/byDayOfWeek/byHour/AOV/today, CSV export, per-currency grouping from Task 3, `loadAnalytics()` rendering) already work and MUST be extended in place. Gaps to close: no explicit today/7-day/30-day presets in UX, no status or normal-vs-preorder breakdowns, product analytics can be skewed if option lines are counted as products, no extensibility contract for future metrics.

**Why this priority**: P2 because it informs decisions but never blocks service. Accuracy and simplicity matter more than chart count.

**Acceptance Scenarios**:

1. **Given** an owner with real orders across pickup/delivery, completed/cancelled, normal/pre-order, **When** analytics loads for today / last 7 days / last 30 days or a custom date range, **Then** total orders, completed orders, cancelled orders, revenue, average order value, pickup-vs-delivery split, and volume over time are shown from exact database aggregation with no estimates.
2. **Given** option/variant order lines exist, **When** product analytics renders, **Then** most-ordered products, quantities, and revenue contribution count each product once per line (options adjust the line, never create phantom products or double counts).
3. **Given** a business that changed currency, **When** revenue is viewed across the change, **Then** amounts stay grouped by their frozen order currency with no automatic conversion and no unlabeled mixed-currency totals; history remains immutable.
4. **Given** analytics queries fail or return empty, **When** the dashboard renders, **Then** ordering, checkout, and tracking keep working; the analytics surface shows a plain empty/error state instead of breaking the page.

---

### Edge Cases

- Order code with wrong case, extra spaces, or 5/13 characters: normalized or rejected with a helpful message; lowercase equals uppercase; no enumeration oracle (uniform 404, no PII).
- Tracking a `cancelled`/`completed` order: terminal state shown immutably; polling stops; cancel button hidden; reorder still offered via current definitions.
- Restaurant closed, deactivated, or subscription-expired between checkout and tracking: tracking still shows the frozen order; new checkout correctly refused by existing gates.
- Item/option deleted or repriced between order and reorder: reorder uses live definitions; dropped items/options are listed, never silently substituted.
- Double-tap place-order / retried status PATCH / replayed SSE event: exactly one order, one transition, one notification (submission-key idempotency + same-status no-op + deduped broadcast).
- Dashboard closed during `order:new`: nothing lost; catch-up on reconnect shows the order (no reliance on the live event for persistence).
- SSE disconnect mid-service: auto-reconnect with backoff; fallback polling continues; order writes unaffected.
- Currency changed mid-month: revenue series groups per frozen currency; AOV computed only within a single currency or labeled per currency, never summed across symbols.
- Empty analytics (new business, all-cancelled period): zero-filled series and plain "no orders yet" instead of fabricated numbers or broken charts.
- Arabic RTL + English: every new string in both dictionaries; timeline, badges, totals, and error states read correctly in both directions; no layout breakage on small screens or 200% zoom.
- Weak devices/networks: confirmation and tracking paint fast on existing styles; skeleton/offline patterns preserved; no new heavy assets or framework.

## Requirements *(mandatory)*

### Functional Requirements

**Task 9 — Customer post-order (extends Tasks 6–8, improves `restaurant.js` confirmation + `track.html`/`track.js`)**

- **FR-901**: After successful checkout, the confirmation MUST show order code, pickup/delivery type, item lines with quantities and chosen options/variants, subtotal, delivery fee, total in the frozen order currency, any pre-order message, relevant timing, and the next step (keep code, track link). It MUST reuse the existing success view and server-confirmed values, never client estimates.
- **FR-902**: Guest tracking MUST work with no account via code entry, confirmation link, and `/track?code=` deep link. It MUST reuse the existing track endpoint and 7-status model (`pending, confirmed, preparing, ready, out_for_delivery, completed, cancelled`).
- **FR-903**: The tracking timeline MUST use the existing flows (5-step pickup, 6-step delivery), mark the current step, show completed steps, render `cancelled` as terminal, flag pre-order lines with their frozen note, and show currency-correct frozen totals.
- **FR-904**: Status updates MUST reach the watching guest via improved polling (visibility-aware cadence, manual refresh affordance, offline/reconnect states). No guest realtime channel SHALL be built in this phase; the owner-dashboard realtime path is unaffected. Polling failure MUST NOT break the order or the page.
- **FR-905**: Reorder MUST rebuild from live menu definitions: only available items, current prices, current valid option groups/choices, tenant-scoped. Stale prices/options MUST be ignored and reported, never applied.
- **FR-906**: Tracking errors (invalid/cancelled/unavailable code, unavailable restaurant, network loss) MUST show plain-language guidance and a next action, with uniform responses that expose no PII, no internal IDs, and no cross-tenant data.

**Task 10 — Owner operations (extends existing `admin.js` orders board + `PATCH /orders/:id/status` + SSE refresh)**

- **FR-1001**: New orders MUST surface within seconds on the open dashboard with full operational detail: customer name, phone/WhatsApp, order type, items + variants/modifiers + quantities, notes, subtotal, delivery fee, total + currency, pre-order flag + timing, date/time. Prominence SHALL be visual-only (highlight, pending badge count, new-first ordering); no sound alert in this phase (clarified 2026-09-30). Existing SSE events MUST be preserved and made more prominent, not replaced.
- **FR-1002**: Pickup vs delivery MUST be visually distinct at list and detail level. Delivery MUST always show the full address; pickup MUST NOT show delivery-address UI.
- **FR-1003**: Pre-orders MUST be visually distinct from immediate orders everywhere they appear, showing the frozen preparation/availability message so owners never mistake them for rush orders.
- **FR-1004**: Status changes MUST offer only valid next transitions from the existing transition map, refuse invalid jumps with a clear message, treat same-status repeats as safe no-ops, and remain correct under concurrent/double submits (existing atomicity preserved).
- **FR-1005**: Operational lists MUST prioritize new/pending, action-needed, and today's orders with current status always visible. History MUST render frozen snapshots (prices, currency, options, fees, totals) immune to later menu edits.
- **FR-1006**: All owner order reads and writes MUST remain tenant-scoped to the authenticated business (`req.user.restaurant_id`; platform-owner access only via the existing explicit path). No weakening of authorization.

**Task 11 — Notifications foundation (new abstraction over existing SSE; Web Push ready)**

- **FR-1101**: A single internal notification abstraction MUST exist so order logic emits domain events (e.g. `order.created`, `order.status_changed`) once, and channels (dashboard realtime now; Web Push when configured; email/SMS later) subscribe without modifying order-write code.
- **FR-1102**: The existing dashboard realtime behavior (`order:new`, `order:status` on `GET /api/admin/events`) MUST keep working through the new abstraction with identical-or-better reliability. Guest status visibility MUST flow through the Task 9 tracking path, not a parallel guest channel.
- **FR-1103**: Notification delivery MUST be asynchronous/non-blocking relative to order writes: checkout, status updates, and their database transactions MUST succeed even if every channel fails. Failures MUST be contained and diagnosable without customer-data leakage.
- **FR-1104**: The abstraction MUST enforce tenant isolation (events carry and check `restaurant_id`; subscribers receive only their business's events) and MUST deduplicate a single domain event into a single user-visible notification per channel via a persisted idempotency key with retention cleanup (clarified 2026-09-30).
- **FR-1105**: Web Push SHALL NOT ship as live push in this phase. The foundation MUST be built (subscription storage shape via safe migration, VAPID configuration points, enablement flag default-off, permission UX hook points) and the missing production configuration documented; credentials MUST NOT be invented and readiness MUST NOT be claimed (clarified 2026-09-30).
- **FR-1106**: No paid external service, marketing/mass-messaging, or promotional-campaign capability may be added in this task.

**Task 12 — Analytics (extends `GET /api/admin/dashboard`, `/analytics`, CSV export, `loadAnalytics()`)**

- **FR-1201**: Analytics MUST provide at minimum: total orders, completed orders, cancelled orders, revenue, average order value, top products (product, quantity, revenue contribution), pickup-vs-delivery split, volume over time, and peak periods where the data supports them — all from exact SQL aggregation, never fabricated or estimated.
- **FR-1202**: Time ranges MUST include today, last 7 days, last 30 days, plus a custom date range picker (clarified 2026-09-30). The custom range MUST be server-validated (start ≤ end, bounded length reusing the existing max-days convention), use the same exact-aggregation queries, and show zero-filled series and plain empty states.
- **FR-1203**: Product analytics MUST count products without corruption from variants/options (option lines adjust their parent line; they never create products or double counts). Order analytics MUST break down by status, pickup-vs-delivery, and normal-vs-preorder where useful.
- **FR-1204**: All monetary analytics MUST respect the Task 3 model: per frozen order currency, no FX conversion, no unlabeled mixed-currency totals, history immutable across settings changes.
- **FR-1205**: Analytics MUST be tenant-isolated (every query scoped by `restaurant_id`) and MUST degrade gracefully: analytics failure never breaks ordering, checkout, tracking, or the rest of the dashboard.
- **FR-1206**: The analytics surface MUST stay nontechnical: clear numbers first, a few simple visuals only where they aid understanding, no BI terminology, Arabic RTL + English intact. The query/structure MUST leave a clean extension path (repeat customers, cancellation rate, prep time, peak hours, comparisons, exports) without a rewrite.

### Key Entities

- **Order confirmation view**: code, type (pickup/delivery), frozen lines + options + pre-order notes, fees/totals + currency, timing, next steps. Derived from the committed order, not client state.
- **Tracking view**: code-addressed guest projection of one order: status, kind-appropriate timeline, frozen summary, cancel/reorder actions. No identity beyond the code.
- **Owner operational order**: same frozen order plus operational fields (customer contact, address when delivery, timestamps) with kind badges (pickup/delivery, pre-order) and allowed next transitions.
- **Notification event**: immutable domain fact (`order.created` / `order.status_changed` with `restaurant_id`, `order_id`/`code`, status, idempotency key, timestamp). Channels consume; order writes never wait for them.
- **Channel subscription**: per-business opt-in/config for a channel (dashboard realtime implicit; Web Push subscription + VAPID config when enabled; future email/SMS placeholders). Tenant-scoped, revocable.
- **Analytics reading**: exact aggregate over a business's orders for a period (counts, revenue per currency, AOV, top products, splits, series). Never a rewrite of stored orders.

### Data requirements

- No change to the meaning of any existing order, item, option, currency, or snapshot column from Tasks 1–8. Frozen fields stay frozen.
- Any new persistence (Web Push subscriptions; notification event/dedup records with a retention rule; optional analytics-friendly indexes) MUST arrive via idempotent, additive, backward-compatible migrations with safe defaults, preserving all existing rows. No `DROP`/`TRUNCATE`/lossy alter without a documented safe path and explicit approval.
- Notification/ analytics reads MUST NOT perform writes inside order transactions. Analytics MUST aggregate with set-based SQL (`GROUP BY` day/status/type/currency/product), avoiding N+1 and double counting (one row per order for order metrics; option lines joined to their parent, never counted as products).
- Seed/demo data (if any) must be clearly fake and never presented as real business metrics.

### Security requirements

- Tenant isolation is non-negotiable: every order/notification/analytics read scoped by the authenticated business; guest tracking authorized by code knowledge only, returning only that order's customer-safe projection (uniform 404 otherwise, no PII/internal IDs).
- Preserve existing authN/authZ, CSRF/origin guards, rate limits (including order/track throttles), server-side validation, and the money rule: client prices/totals ignored; totals, fees, availability, hours, and subscription gating recomputed server-side at write time.
- Notification payloads carry the minimum needed per recipient (dashboard gets operational detail; guest gets own-order status); never broadcast one business's data to another; log without secrets, tokens, or customer data.
- No customer accounts, no new roles, no privilege expansion in this phase.

### Reliability requirements

- Order writes (create, status change, cancel) MUST succeed independently of notifications, realtime, and analytics. Each of those subsystems may fail or be offline without affecting the order transaction.
- Idempotency preserved end to end: submission-key single creation; same-status no-op; duplicate SSE/event delivery collapsed to one visible notification; double status PATCH safe.
- Reconnect/resume MUST be automatic: dashboard SSE reconnects with backoff; guest tracking resumes polling on visibility/online with manual refresh available; terminal states stop polling.
- No polling storms: guest tracking reuses the existing polling cadence with visibility awareness (clarified 2026-09-30); dashboard keeps SSE; custom-range analytics queries stay bounded like the existing period queries.

### Performance requirements

- No N+1 in any new read (batched option/snapshot attach preserved; analytics single-aggregate queries; dashboard lists paginated as today).
- Appropriate indexes only where the query plan needs them (e.g. `(restaurant_id, created_at)`, `(restaurant_id, status)` if missing); no speculative index sprawl.
- Confirmation/tracking first paint stays fast on weak phones: reuse existing CSS/components, no new framework, no heavy assets, skeleton/offline patterns intact.
- Analytics queries bounded by period (`days` 1–90 pattern) and `restaurant_id`; CSV export streams or caps rows; directory/menu endpoints untouched.

### Migration requirements

- All schema change via `database/migrations/*.sql` + `database/migrate.js` idempotent pattern (`ADD COLUMN IF EXISTS` style, `schema_migrations` tracking). Re-runnable as no-op.
- Backward compatible: old rows valid under new code; new nullable columns default safe; feature flags default off (Web Push disabled until configured).
- Reversible or safely recoverable where practical; rollback notes in the plan. Historical order meaning never altered.

### Testing requirements

- TDD for non-trivial logic (notification dedup/fan-out, reorder rebuild, analytics aggregation, timeline projection) with the smallest runnable check per constitution.
- Extend `tests/` in place: guest confirmation/tracking incl. pickup/delivery/pre-order timelines + error/terminal states; reorder with changed/deleted items/options; owner ops incl. invalid/duplicate transitions + tenant isolation; notification abstraction incl. channel-failure-does-not-break-order + no cross-tenant leak + no duplicates; analytics incl. per-currency grouping, no FX, no double count, zero-filled series, empty states.
- `npm run check` 0 failures required; `node --test tests/` on a disposable `TEST_DATABASE_URL` (never prod); manual smoke on phone-sized viewport in AR + EN: checkout → confirmation → track → status advance → reorder; dashboard new-order arrival → status advance → history; SSE drop/reconnect; analytics today/7/30-day.
- Never weaken existing tests to pass. Close the Tasks 1–8 `BLOCKED: no TEST_DATABASE_URL` debt as part of Task 9–12 validation.

### Acceptance criteria

- **AC-9.1** Guest places pickup, delivery, normal, and pre-order variants; each confirmation shows code + full summary + type + timing + pre-order info + next step; tracking shows correct timeline per kind in AR and EN with no login.
- **AC-9.2** Status advance is visible to the watching guest promptly; killing the realtime connection still leaves a correct order via fallback, and reconnect recovers without duplicates.
- **AC-9.3** Reorder from tracking/confirmation rebuilds from live definitions; changed/unavailable items are reported, stale money never applied.
- **AC-10.1** New order appears on the open dashboard within seconds with complete operational detail; pickup/delivery and pre-order/normal are distinguishable at a glance in list and detail.
- **AC-10.2** Only valid next statuses are offered; invalid jumps refused; double submits leave one correct state; history shows frozen snapshots.
- **AC-11.1** Order logic emits each domain event once through the abstraction; dashboard realtime preserved; a dead channel never fails checkout or status updates; no duplicate user-visible notifications per event; no cross-tenant delivery.
- **AC-11.2** Web Push foundation exists (migration, config points, default-off flag, setup docs) with missing production pieces explicitly documented — live push is out of scope for this phase and readiness is never faked.
- **AC-12.1** Today/7-day/30-day and custom-range analytics show exact counts, revenue per currency (no conversion, no mixed totals), AOV, top products, pickup/delivery split, volume over time; option lines never corrupt product counts; empty periods show plain zero states.
- **AC-X.1** Full suite green on disposable DB, `npm run check` 0 failures, AR+EN smoke on mobile viewport, no regression in Tasks 1–8 journeys.

### Explicit out-of-scope

Customer accounts, CRM, loyalty, reviews, favorites, GPS/driver tracking, driver app, fleet/route/settlement, restaurant ERP, inventory, bookings/reservations changes, online payment gateways, paid email/SMS vendors, marketing/mass/promo messaging, React migration or any framework rewrite, new dependencies without clear value, per-type forked systems, SEO/marketing pages, lead-generation/Agent Reach.

### Dependencies on Tasks 1–8

- T1/T2 (business types, capability boundaries): one shared flow; kind badges are presentational; no per-type forks.
- T3 (currency): frozen per-order currency, integer cents, server formatting, per-currency grouping, no FX — binding on confirmation, tracking, owner detail, notifications, and analytics.
- T4 (storefront UX): identity, search, cart, totals, RTL/EN, skeleton/offline, weak-device budget — the surface Tasks 9–12 extend.
- T5 (options/variants): replace-base + adjust-on-top pricing, min/max groups, server validation, immutable `order_item_options` snapshots — binding on confirmation summaries, owner detail, reorder rebuild, and product analytics.
- T6–T8 (pre-order + checkout + lifecycle): `is_preorder`/`preorder_note` snapshots, transactional server-priced checkout with `submission_key` idempotency, 7-status `TRANSITIONS` with terminal immutability, atomic customer cancel within grace, SSE hub + polling timeline, `?reorder=id:qty` — the foundation Tasks 9–12 verify and extend, never replace.

### Risks and edge cases

- Notification work tempts a broker/queue dependency the deployment cannot support — mitigate by staying in-process + abstraction, documenting the multi-node ceiling with a `ponytail:` note instead of adding infra.
- Web Push tempts invented VAPID keys — mitigate by FR-1105's document-don't-fake rule.
- Analytics tempts mixed-currency sums and option-line double counts — mitigate by per-currency grouping + parent-line counting, both covered by tests.
- Reorder tempts blind replay of frozen prices — mitigated by FR-905 live-definition rebuild.
- Dashboard prominence tempts noisy alert spam — mitigate by one-notification-per-event dedup and prioritizing pending/action-needed over decoration.
- See Edge Cases section for code-format, terminal-state, closed-restaurant, SSE-drop, currency-change, empty-data, RTL, and weak-device risks.

### Compatibility requirements

- Preserved: restaurant names/slugs/URLs (`/restaurant/:slug` frozen), existing orders/users/menus, `/track` + `/track?code=` behavior, all `/api/*` shapes (additive fields only), auth/session/CSP/origin/rate-limit behavior, tenant-isolation semantics, subscription/closed/hours gating, WhatsApp `wa.me` flows, i18n dictionaries (new keys in both AR+EN), skeleton/offline, `app.yaml` deploy contract.
- Additive only: no breaking route/payload changes; no migration that rewrites history; no framework, build step, or TypeScript; no new runtime service.

## Success Criteria *(mandatory)*

- **SC-901**: A first-time guest completes checkout → confirmation → tracking → reorder understanding on a phone in under 3 minutes with no account and no help, in Arabic or English.
- **SC-902**: 9 of 10 watched test orders show their status change to the guest within the improved polling interval after the owner action, with 10 of 10 correct even when connectivity is disrupted; the owner dashboard keeps its realtime immediacy.
- **SC-1001**: An owner spots a new order on the open dashboard within 15 seconds of checkout and can advance it to the correct next status on the first attempt without confusing pickup/delivery or pre-order/normal.
- **SC-1002**: Zero invalid status transitions and zero corrupted states across duplicate/concurrency tests; history always matches the frozen purchase.
- **SC-1101**: With all notification channels deliberately broken, 100% of checkout and status-update attempts still succeed; with channels healthy, each order event produces exactly one user-visible notification per channel with zero cross-tenant deliveries.
- **SC-1201**: Owner analytics for today/7/30 days and any valid custom range match hand-computed database aggregates exactly (counts, revenue per currency, AOV, top products, splits); no estimates, no mixed-currency totals, no option-line double counts.
- **SC-X01**: Full test suite passes on a disposable database, syntax check reports 0 failures, and the AR+EN mobile smoke (Tasks 1–12 journeys) passes with no regression to existing ordering behavior.

## Assumptions

- Tasks 1–8 code, migrations 001–024, routes, services, SSE hub, tracking page, dashboard, analytics endpoints, and tests in the working tree are the source of truth; docs (HANDOFF/README) are advisory where they conflict with code.
- Existing transition map, submission-key idempotency, 15s guest polling, 25s SSE heartbeat, 15-minute customer cancel grace, and per-currency grouping are kept; Tasks 9–12 tune presentation and reliability, not these values, unless a test proves them broken.
- Web Push may require production VAPID keys and permission UX that cannot be fully verified here; the default assumption is foundation + docs over faked readiness.
- Analytics offers today / last-7 / last-30 presets plus a bounded, server-validated custom date range (clarified 2026-09-30); the range reuses the existing exact-aggregation pattern with zero-filled series.
- Test/disposable database URL can be provisioned for validation; production data is never used for tests.
- Arabic remains the default RTL language with English toggle via the existing dictionary mechanism.
