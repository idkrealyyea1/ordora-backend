# Feature Specification: Production Hardening + Demand-Driven Advanced Features (Task 17 + Task 18)

**Feature Branch**: `016-production-hardening-demand-features`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "FINAL ROADMAP PHASE — TASK 17 + TASK 18: production hardening, scalability, and demand-driven advanced features for the Restivo multi-tenant food-business SaaS (Node.js + Express + PostgreSQL + vanilla HTML/CSS/JS). Task 17 turns the feature-complete app into a safe, reliable, observable SaaS. Task 18 establishes an evidence-driven framework for advanced features and implements only what real demand justifies. No React migration, no payment gateway, no second cart/checkout, no duplicate business-type or entitlement systems, no fake functionality, no premature infrastructure."

## Clarifications

### Session 2026-10-03

- Q: How should the system recognize that two checkout submissions are the same customer intent rather than two separate orders? → A: Client-generated idempotency key; server stores it with a uniqueness guarantee per business and returns the existing order on replay.
- Q: What operating scale should Task 17 harden and verify the system against? → A: Moderate — hundreds of businesses, around 1,000 orders per day, burst of ~50 concurrent checkouts.
- Q: What data-loss tolerance should the backup and restore procedure be designed to meet? → A: Daily backups kept at least 14 days, restore rehearsed on a non-production copy with recorded outcome.
- Q: Should Task 18 ship any concrete advanced feature in this phase, or only the evidence framework with everything deferred? → A: Framework plus decision record — build the template, evaluate the top candidates, ship at most what clearly passes.
- Q: How should the liveness and readiness signals be exposed for the hosting platform? → A: Keep the existing lightweight endpoint as liveness, add a separate readiness endpoint that verifies database reachability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer places an order reliably under real-world failure (Priority: P1)

A hungry customer on a weak mobile connection browses a restaurant storefront, adds items to the cart, and checks out as a guest. They double-tap the order button, refresh the browser mid-submit, or retry after a network timeout. The system creates exactly one order, priced from the restaurant's own menu data (never from values sent by the browser), with the correct delivery fee, availability, hours, and business-open checks. A failed optional extra (for example a notification or an image) never blocks or corrupts the order, and the customer gets a trackable order code.

**Why this priority**: Ordering is the revenue path. Duplicate or manipulable orders destroy trust and money. Everything else is secondary.

**Independent Test**: Can be fully tested by submitting the same checkout twice (double-click, refresh, retry, two tabs) against a live menu and confirming exactly one order exists with server-computed totals, then changing menu prices and confirming the placed order keeps its original snapshot.

**Acceptance Scenarios**:

1. **Given** a menu with known prices and a delivery fee, **When** a guest submits checkout with tampered prices/totals in the request, **Then** the order is created with the correct server-computed totals and the tampered values are ignored.
2. **Given** a guest who submits checkout twice within seconds (retry/double-click/refresh), **When** both requests reach the system, **Then** exactly one order is created and the second submission returns the same order rather than a duplicate.
3. **Given** a restaurant that is closed, outside hours, or has an item marked unavailable, **When** a guest attempts checkout with that item, **Then** checkout is rejected with a clear message and no order is created.
4. **Given** a successful order where the notification delivery fails, **When** the failure occurs, **Then** the order still exists with correct status and the failure is recorded without rolling back the order.

---

### User Story 2 - One restaurant can never see or change another restaurant's data (Priority: P1)

A restaurant admin logged into restaurant A tries (deliberately or via a crafted URL, request body, or query parameter) to read, edit, or delete products, categories, orders, images, settings, notifications, or analytics belonging to restaurant B. A platform operator acting across restaurants does so only through explicit, authorized paths. Every attempt outside those paths is denied, and automated tests prove the boundary for every tenant-scoped resource.

**Why this priority**: Multi-tenant isolation failure is a breach. It blocks any production claim.

**Independent Test**: Can be fully tested by authenticating as restaurant A and requesting every read/write path for restaurant B resources (products, categories, orders, images, settings, notifications, analytics, delivery settings, subscription data), confirming each is denied without leaking B's data.

**Acceptance Scenarios**:

1. **Given** an admin authenticated for restaurant A, **When** they request an order, product, category, image, or setting that belongs to restaurant B (by identifier in URL, body, or query), **Then** access is denied and no data from B is returned.
2. **Given** an unauthenticated visitor, **When** they call any admin or owner operation, **Then** access is denied and no tenant data is exposed.
3. **Given** a platform operator viewing restaurant B, **When** they use the authorized cross-restaurant path, **Then** access succeeds and the access is attributable; any other path is denied.

---

### User Story 3 - The platform starts, stops, and deploys predictably (Priority: P2)

A deploy runs the pipeline: checks, tests, migration validation, startup validation, deploy, health check, smoke test, monitor. Startup validates required configuration and database availability and fails with a clear message when a required dependency is missing, instead of serving a broken app. Shutdown drains active requests and releases resources cleanly. Health reporting distinguishes "process is alive" from "ready to serve traffic" without exposing secrets, so the hosting platform can route traffic correctly. Migrations apply in order, handle failure safely, and never silently destroy data.

**Why this priority**: Without deterministic startup, health, migrations, and deployment safety, every release is a gamble.

**Independent Test**: Can be fully tested by deploying with a missing required setting, with the database unreachable, and with a failing migration, and confirming each case fails fast with a clear message; plus a successful deploy where the liveness check passes while the readiness check waits for the database, then both pass.

**Acceptance Scenarios**:

1. **Given** a deployment with a missing required setting or an unreachable database, **When** the app boots, **Then** it refuses to serve traffic and reports the specific missing dependency without exposing secret values.
2. **Given** a running instance receiving a stop signal with active requests and open realtime connections, **When** shutdown proceeds, **Then** active requests complete or time out within a bounded window, realtime connections are closed cleanly, and the process exits.
3. **Given** a migration that fails partway, **When** the operator investigates, **Then** the schema state is unambiguous (which migrations applied), re-running is safe, and no partial business data (business, menu, order, subscription) is left half-created.

---

### User Story 4 - Operators can see what happened and recover data (Priority: P2)

When something important happens — startup, shutdown, migration failure, login failure, denied access, business creation, onboarding completion, subscription state change, order creation, order status change, notification failure, image failure, unexpected error — the event is traceable without containing passwords, secrets, tokens, or unnecessary personal data. Error responses distinguish validation, authentication, authorization, not-found, conflict, rate-limited, dependency-failure, and unexpected-error cases, and never expose stack traces or internals in production. The backup and restore procedure states what is backed up, how often, how long it is kept, how to restore, and how restore was last verified.

**Why this priority**: An untraceable failure and an untested backup are both silent data-loss risks.

**Independent Test**: Can be fully tested by triggering each important event and confirming a trace exists with no secrets; requesting a failing endpoint in production mode and confirming a safe error envelope; and walking the documented restore procedure against a non-production copy.

**Acceptance Scenarios**:

1. **Given** an order creation followed by an order status change and a subscription state change, **When** an operator reviews traces, **Then** each event is attributable (who, which business, when, outcome) with no passwords, secrets, or tokens recorded.
2. **Given** a production request that fails unexpectedly, **When** the client receives the error, **Then** it contains a stable error code and a safe message with no stack trace, while the full diagnostic is available server-side.
3. **Given** the documented backup procedure, **When** a restore is rehearsed on a non-production database, **Then** the business data (businesses, menus, orders, subscriptions) is recovered and the rehearsal result is recorded with date and outcome.

---

### User Story 5 - Owner runs the whole business without platform help; new capabilities arrive only with evidence (Priority: P3)

A new food-business owner discovers Restivo, signs up, picks a business type (restaurant, cafe, bakery, dessert shop, home kitchen, cloud kitchen), completes onboarding, adds a first product, sets hours and fulfillment, publishes the store, receives real orders, manages them from a simple Arabic/English dashboard, gets notifications, understands analytics, and manages the subscription — all without manual platform intervention. Future advanced capabilities (variants, promotions, loyalty, accounts, reorder, delivery operations, reservations, richer analytics) appear only where the business type supports them, only when the subscription entitles them, and only after real evidence (requests, drop-off, repeated manual work, usage, churn, revenue impact) justifies the cost — evaluated through the existing central capability system, never hard-coded plan checks or parallel systems. Guest ordering stays the default and the dashboard stays simple for non-technical merchants.

**Why this priority**: This is the product goal, but it must not destabilize the hardening work: Task 17 ships first, Task 18 follows behind the evidence gate.

**Independent Test**: Can be fully tested by walking the full new-owner journey (discover → sign up → business type → onboard → first product → hours → publish → order → manage → notify → analytics → subscription) in both Arabic/English, plus evaluating one candidate advanced feature through the evidence template and confirming it either ships behind the capability gate or is explicitly deferred with a recorded reason.

**Acceptance Scenarios**:

1. **Given** a new owner with no technical help, **When** they complete onboarding through publishing, **Then** the storefront is publicly orderable and the dashboard shows status, orders, and subscription without platform intervention.
2. **Given** a candidate advanced feature, **When** it is evaluated (problem, user, evidence, value, complexity, risk, dependencies, maintenance, scalability, monetization, simplicity impact), **Then** it ships only with a recorded justification, appears only for entitled business types, is enforced server-side, and leaves the basic journey (discover → store → menu → cart → checkout → order → track) unfragmented.
3. **Given** an Arabic-speaking owner and customer, **When** they switch to English and back, **Then** layout direction, dates, numbers, and currency follow the locale and no hard-coded single-locale assumptions (phone, date, timezone, currency) break the flow.

---

### Edge Cases

- What happens when two customers order the last available item at the same instant? Only valid orders succeed; availability is decided server-side at write time.
- What happens when the menu changes (price, availability, hours) between adding to cart and submitting? Checkout re-validates everything at submit time against current server data.
- What happens when a subscription lapses mid-session (trial ends, grace expires)? Reads stay reachable; further mutations are blocked with a clear subscription message, and grandfathered businesses without subscription rows are never silently deactivated.
- What happens when realtime (dashboard updates) or push-notification delivery fails or the process restarts? Orders and business data are unaffected; missed realtime events are recoverable by refresh, and failures are recorded.
- What happens under burst traffic (many customers browsing while owners work dashboards and analytics run)? Browsing and ordering stay responsive; expensive analytics reads cannot starve checkout writes.
- What happens when an image upload is corrupt, oversized, or spoofed? The upload is rejected safely without touching business data, and tenant ownership of stored images is enforced on read and delete.
- What happens when a second instance of the app is started (horizontal scale)? Behavior is classified per subsystem (safe / needs shared infrastructure / needs later architectural change / intentionally single-instance), and no silent divergence (sessions stay valid, rate behavior stays sane, realtime limits are documented).

## Requirements *(mandatory)*

### Functional Requirements — TASK 17: Production Hardening + Scalability

- **FR-001**: System MUST create exactly one order per customer checkout intent across double-click, refresh, retry, multi-tab, and network-retry submissions. Each checkout request MUST carry a client-generated idempotency key; the server MUST store it with a uniqueness guarantee per business and return the existing order on replay instead of creating a duplicate.
- **FR-002**: System MUST compute all order money (line prices, quantities, delivery fees, totals) and validate availability, business status, hours, and order-type rules server-side at submit time, ignoring any client-sent money or ownership values.
- **FR-003**: System MUST enforce the documented order status lifecycle (including cancellation rules) and reject invalid transitions with a clear conflict error.
- **FR-004**: System MUST derive restaurant identity for admin operations exclusively from the authenticated user's stored record, never from client-supplied identifiers, and deny cross-restaurant access to products, categories, orders, images, settings, notifications, analytics, delivery settings, subscription, and onboarding data.
- **FR-005**: System MUST enforce owner, admin, platform-operator, and delivery roles plus subscription state, business type, and capability gates server-side on every request; changing URL, body, query, or client storage MUST NOT grant access.
- **FR-006**: System MUST validate subscription state transitions (trial, active, grace, expired, cancelled, suspended, plus grandfathered businesses with no subscription row) and MUST NOT silently deactivate grandfathered businesses; grace MUST preserve access per the stated policy and every change MUST be auditable.
- **FR-007**: System MUST start deterministically: validate required configuration, verify database reachability, apply migrations in order with unambiguous applied/failed state, and refuse to serve traffic with a clear non-secret message when a required dependency is unavailable.
- **FR-008**: System MUST shut down gracefully: stop accepting new work, bound in-flight request handling, close realtime connections and background resources, and release the database pool.
- **FR-009**: System MUST expose separate liveness ("process alive", keeping the existing lightweight endpoint) and readiness ("can serve traffic safely, database reachable", via a separate endpoint that verifies database reachability) signals suitable for the hosting platform, containing no secrets or tenant data.
- **FR-010**: System MUST isolate non-critical failures: notification, analytics, optional image, or realtime failures MUST NOT block or corrupt order creation or business data, while critical failures (database, auth, checkout integrity) MUST still surface loudly.
- **FR-011**: System MUST wrap multi-step business creation, onboarding completion, order creation, status transitions, subscription transitions, capability changes, image management, and notification persistence in the smallest transaction that guarantees atomicity — no partial business/menu/order/subscription records on failure, no giant unnecessary transactions.
- **FR-012**: System MUST enforce data integrity for tenant ownership, unique business identifiers, unique order identifiers, valid status values, valid product/category/order relationships, and valid image/notification ownership at the appropriate layer (database constraint where the rule belongs to the data, application logic where it belongs to behavior), never frontend-only.
- **FR-013**: System MUST apply rate protection to login, signup, onboarding, order creation, order tracking, image uploads, and admin operations that blocks abuse without preventing normal customers from ordering, considering caller identity and tenant context where appropriate.
- **FR-014**: System MUST use parameterized queries exclusively, escape untrusted output, validate and normalize all input at trust boundaries (including upload type/size/content checks and safe file handling), and MUST NOT weaken existing session, cookie, origin, or security-header protections to make a feature work.
- **FR-015**: System MUST return a consistent error envelope distinguishing validation, authentication, authorization, not-found, conflict, rate-limited, dependency-failure, and unexpected-error cases, with safe messages and no stack traces or secrets in production.
- **FR-016**: System MUST record traceable events for startup, shutdown, migration/database failure, authentication and authorization failures, business creation, onboarding completion, subscription changes, order creation and status changes, notification/image failures, and unexpected errors — without recording passwords, secrets, tokens, or unnecessary personal data.
- **FR-017**: System MUST document the real backup, retention, and restore procedure for the deployed database (daily backups kept at least 14 days; what, frequency, retention, where, restore steps, migration compatibility, last verification rehearsal on a non-production copy) reflecting actual platform capabilities, not assumed ones.
- **FR-018**: System MUST document the deployment pipeline (check → test → migration validation → startup validation → deploy → health check → smoke test → monitor) with smoke coverage of home, discovery, storefront, tracking, login, dashboards, pricing, sitemap/robots, and 404 behavior, and MUST NOT deploy production changes without explicit approval.
- **FR-019**: System MUST classify every single-instance assumption (realtime hub, rate counters, sessions, caches, temporary data, background work, locks, scheduled tasks, file/image storage) as safe-for-multiple-instances, needs-shared-infrastructure, needs-later-architectural-change, or intentionally-single-instance, and document current safe-scale assumptions (hundreds of businesses, ~1,000 orders/day, ~50 concurrent checkouts), known limits, and what would trigger the next architectural evolution — without adding shared infrastructure until measurements or architecture require it.
- **FR-020**: System MUST keep the current image-storage approach unless a justified, measured decision changes it; if kept, its limits (size caps, per-business impact, retrieval cost, backup impact, tenant isolation) MUST be documented as acceptable at current scale.
- **FR-021**: System MUST define realistic performance targets for storefront load, dashboard load, order creation, key reads, and image payloads on weak/mobile devices, identify measured bottlenecks (slow queries, repeated calls, oversized payloads, wasteful polling), and fix only what measurements justify — without introducing stale-cache behavior into ordering or subscription decisions.
- **FR-022**: System MUST strengthen test coverage around tenant isolation, authorization, ordering concurrency/duplicates, onboarding, subscriptions/entitlements, notifications, and deployment-critical paths (startup, migrations, health, shutdown), prioritizing business-critical behavior over test count.

### Functional Requirements — TASK 18: Demand-Driven Advanced Features

- **FR-023**: System MUST evaluate every candidate advanced feature through a recorded evidence template (problem, user, evidence source, value, complexity, risk, dependencies, maintenance, scalability, monetization, simplicity impact) before implementation, producing a decision record that ships at most the candidates that clearly pass and defers the rest with stated reasons.
- **FR-024**: System MUST implement advanced features only through the existing central capability/entitlement evaluation (business type AND plan entitlement AND subscription state AND configuration) — never scattered plan-name checks, never a parallel business-type or entitlement system.
- **FR-025**: System MUST present advanced features with progressive disclosure (optional settings, sensible defaults, guided configuration, business-type-aware navigation) so basic non-technical merchants can operate without encountering advanced concepts.
- **FR-026**: System MUST preserve guest ordering as the default customer journey (discover → store → menu → product → cart → checkout → order → track) and MUST NOT add customer friction (accounts, extra steps) without recorded evidence.
- **FR-027**: System MUST apply the same backend discipline to every advanced feature as to core features: server-side validation, authorization, tenant isolation, error handling, test coverage, localization where user-visible, and auditability where sensitive.
- **FR-028**: System MUST model advanced-feature data with the smallest appropriate relational extension, reusing existing tables where possible and avoiding duplicate business relationships, unstructured catch-all fields, or unjustified denormalization.
- **FR-029**: System MUST NOT collect new customer personal data for advanced features without recording why it is needed, how long it is kept, who can access it, and that it is tenant-isolated.
- **FR-030**: System MUST keep advanced features free of hard-coded single-locale assumptions (currency, language strings, date/phone/timezone formats) while not expanding locales beyond what a spec demands.
- **FR-031**: System MUST record the query, storage, payload, bundle, mobile, caching, and scalability impact of each shipped advanced feature, and MUST NOT ship a feature that works functionally but creates unacceptable operational cost.
- **FR-032**: System MUST update architecture, deployment, environment, migration, backup/restore, scaling, capability, subscription, and operational documentation to reflect reality for every shipped change, and MUST NOT document behavior that does not exist.
- **FR-033**: Task 17 hardening MUST be implemented, stabilized, and verified before Task 18 work begins, and Task 18 work MUST NOT introduce instability into hardened paths (ordering, tenancy, subscriptions, startup, migrations, health).

### Key Entities *(include if feature involves data)*

- **Order intent**: a customer's single checkout attempt identified by a client-generated idempotency key; replays of the same key resolve to the one stored order (server-computed money, frozen price snapshot).
- **Tenant boundary**: the authenticated-user → business → resource chain that every tenant-scoped read/write (products, categories, orders, images, settings, notifications, analytics, subscriptions) must satisfy.
- **Subscription state**: the effective access state (trial, active, grace, expired, cancelled, suspended, grandfathered) derived live from stored data and server time; gates mutations while keeping reads reachable per policy.
- **Capability grant**: the live answer to "can this business perform X?", combining business type, plan entitlement, subscription state, and configuration through one central evaluation.
- **Health signals**: liveness (process alive) versus readiness (able to serve traffic safely); used by the hosting platform, containing no secrets.
- **Operational trace**: the attributable record of an important event (who, which business, when, outcome) with no secrets or unnecessary personal data.
- **Feature evidence record**: the written justification for an advanced feature (problem, user, evidence, value, cost, risk) that decides build versus defer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Guests complete storefront-to-order (browse → cart → checkout → trackable order code) in under 3 minutes on a mid-range mobile device, and duplicate submissions (double-click, refresh, retry) never produce a second order.
- **SC-002**: Zero cross-restaurant data exposures: scripted attempts as restaurant A against every tenant-scoped path of restaurant B are all denied, and the isolation test suite passes on every run.
- **SC-003**: Failed deploys fail safe: missing configuration, unreachable database, and broken migration cases each refuse traffic with a specific actionable message, and the readiness signal gates traffic until the system can genuinely serve it.
- **SC-004**: 95% of storefront menu reads complete in under 2 seconds on a throttled mobile connection, and order submission remains responsive while dashboard and analytics activity runs concurrently.
- **SC-005**: Every important event (startup, shutdown, migration/database failure, denied access, business creation, onboarding completion, subscription change, order creation/status change, notification/image failure, unexpected error) is traceable within 5 minutes of occurrence without exposing secrets.
- **SC-006**: A rehearsed database restore on a non-production copy recovers businesses, menus, orders, and subscriptions, and the rehearsal date and outcome are recorded; the procedure reflects actual platform capabilities.
- **SC-007**: A new non-technical owner goes from discovery to a published, order-receiving store with no platform-operator intervention, in both Arabic and English, with guest checkout intact.
- **SC-008**: Every shipped advanced feature carries a recorded evidence justification, appears only for entitled business types, passes the same security/tenant/isolation tests as core features, and adds no required step to the basic customer journey.

## Assumptions

- Existing architecture (Node.js + Express + PostgreSQL + vanilla HTML/CSS/JS, server-side sessions in PostgreSQL, idempotent SQL migrations, current test suite) is retained; no framework migration, payment gateway, second cart/checkout, or parallel business-type/entitlement system is in scope.
- Current scale is a single-application-instance monolith on the existing hosting region with a managed database; horizontal-scale work in this phase is classification and documentation, with shared infrastructure added only when measurements or architecture require it.
- Image storage stays database-backed unless Task 17 measurement proves otherwise; limits and costs are documented rather than migrated speculatively.
- Subscription lifecycle has no background scheduler: states derive live from stored data and server time; renewal/billing-provider integration is out of scope and the system stays decoupled from future billing providers.
- Realtime dashboard updates and push notifications are best-effort delivery alongside persisted state: a missed event is recoverable by refresh, and their failure never blocks ordering.
- Performance targets are validated against weak/mobile devices and throttled networks, not laboratory conditions; caching is applied only where safe and never to ordering or subscription decisions.
- Deployment to production requires explicit human approval; automated steps stop at validation and staging-equivalent checks.
