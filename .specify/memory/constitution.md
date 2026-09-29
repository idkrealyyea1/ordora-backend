# Restivo Constitution

## Core Principles

### I. Preserve Working Functionality

Do not remove or change user-visible behavior unless it is demonstrably
broken, insecure, contradictory, or explicitly being replaced. Every change
MUST preserve `/api/*`, auth, dashboards, `/restaurant/:slug`, and `/app/`
compatibility unless the spec explicitly allows breakage with a migration.

### II. No React Migration Without Explicit Request

The storefront/app MUST stay vanilla HTML/CSS/JS with no build step and no
TypeScript unless explicitly requested. Never rewrite or migrate to React
for stylistic or modernity reasons. The existing `frontend/` React scaffold
is grandfathered; do not expand it or duplicate the vanilla app into it.

### III. No Architecture Rebuild Without Evidence

Never rebuild existing architecture without evidence the current
architecture cannot support the requirement. Prefer small, isolated,
reviewable, revertable changes over large rewrites. Refactoring MUST be
incremental and verifiable.

### IV. Inspect Before Deciding

Before architectural decisions or modifying a module, inspect existing
code, database migrations, tests, routes, services, middleware, frontend,
and runtime behavior. Trace callers, dependencies, data flow, and
authN/authZ end to end first. A fix in the wrong place is a second bug.

### V. Source of Truth Is Code, Migrations, Tests, Runtime

Current source, migrations, tests, and verified runtime behavior are
authoritative. Stale documentation is non-authoritative. Use `HANDOFF.md`,
`README.md`, and `a.md` as runtime guidance, but code wins on conflict.
Rationale: docs drift; behavior does not.

### VI. No Guessing on Shared Code

Do not guess. Before changing shared code, inspect all references and
usages plus known consumers (APIs, routes, DB fields, shared utils).
Client-sent totals/prices MUST be ignored; totals, fees, availability,
hours, and subscription gating MUST be recomputed server-side.

### VII. Safe Migration Strategy Required

Every database change MUST have a safe migration strategy. Migrations in
`database/migrations/*.sql` MUST be idempotent via `migrate.js` plus
`schema_migrations`. Prefer backward-compatible migrations with safe
defaults. Money in cents; snapshot prices at purchase time.

### VIII. No Destructive Migrations Without Justified Safe Path

Never use destructive migrations without explicit justification and a safe
migration path. Preserve existing data. No `DROP`/`TRUNCATE`/lossy alter
without a documented rollback and approval in the spec.

### IX. Tenant Isolation and Authorization Boundaries (NON-NEGOTIABLE)

Restaurant identity MUST come only from the authenticated user's DB record
(`req.user.restaurant_id` via `attachUser`), never from params, query, or
body. Every tenant query MUST be scoped by `restaurant_id`. Cross-tenant
owner/staff access MUST be explicit (`?restaurantId=` plus
`requireOwnerOrStaff`) and still server-checked. Violation blocks release.

### X. Do Not Weaken Security Posture

Do not weaken security, validation, session handling, CSRF/origin
protection, rate limiting, or input/output safety. Passwords bcrypt cost
12, never returned. Sessions server-side in Postgres, HttpOnly plus
SameSite=Lax, `__Host-` plus Secure in prod, regenerate on login, revoke
on reset/deactivation. Parameterized SQL only. Strict CSP
(`default-src 'self'`, no inline scripts). Origin guard on mutating
requests. Uploads magic-byte sniffed, MIME allow-listed, size-capped,
stored as `bytea` in `uploaded_files`, never ephemeral disk. Rate-limit
global/auth/order in-process. Validate at trust boundaries in
`validators/`, mass-assignment safe, reject unknown fields, fail closed.
Hiding a frontend element is never protection; admin ops need
server-checked roles every request. Error envelope MUST hide internals in
prod; no secrets, tokens, or traces to clients.

### XI. Dependencies Require Value and Compatibility

Do not add dependencies unless they provide clear value and are compatible
with the existing architecture and deployment. Runtime is Node 20 plus,
Express 4, PostgreSQL via `pg`. No new service, framework, or infra the
deployment cannot support without an explicit plan.

### XII. Simplicity Over Abstraction

Prefer simple solutions over unnecessary abstractions. No interface with
one implementation, no factory for one product, no config for a static
value, no single-use abstractions. Boring over clever. Deletion over
addition. Reuse order: existing helper, stdlib, native platform,
installed dep, one-liner, then minimal new code.

### XIII. No Speculative Features

Do not build features merely because they are technically possible. No
scaffolding for later; later scaffolds for itself. Every addition MUST
justify its present cost.

### XIV. Purpose-Gated Features

Every feature MUST have a clear customer, business, operational, or
architectural purpose stated in its spec. Features without a named
beneficiary MUST NOT be built. Rationale: prevents bloat disguised as
progress.

### XV. Extremely Simple Customer Experience

Keep the customer experience extremely simple, especially for mobile and
nontechnical users. Fewest steps, largest touch targets, plain language,
usable under poor networks. No extra API/DB weight for marketing visuals.

### XVI. Guest Checkout Is Core

Guest checkout remains a core principle unless explicitly changed. Ordering
MUST NOT require an account. Checkout math, delivery fees, availability,
closed/outside-hours enforcement (server clock/timezone), and status
transitions MUST be validated server-side at write time, not just render.

### XVII. No Payment Gateway — Out of Scope

Online payment gateway integration is currently out of scope. Do not add
payment providers, card handling, or PCI scope unless a future spec
explicitly reopens it. Rationale: avoids security, compliance, and
operational scope without a customer mandate.

### XVIII. One System for Restaurants and Food Businesses

The system MUST support restaurants and broader food businesses (cafes,
cake shops, dessert shops) without creating separate applications per
business type. One codebase, one deployment, one operational model.

### XIX. Configurable Capabilities Over Duplication

Prefer configurable business capabilities over duplicated
business-specific systems. Vary behavior via settings, categories,
menu/ordering options, and content, not forks or parallel stacks.
Rationale: one fix benefits every business type.

### XX. Internationalization Foundations Without Premature System

Design foundations for international currencies and localization without
prematurely implementing the full system. Keep money in integer cents,
locale-aware formatting isolated, and content paths extendable. Marketing
stays static HTML with baked-in Arabic-default content (single URL,
`lang=ar dir=rtl` default; `i18n.js` enhancement only). No full i18n
framework until a spec demands it.

### XXI. Honest SEO for Public Pages

SEO is a real product requirement for public pages. Use honest titles,
descriptions, canonical URLs, `robots.txt`, and `sitemap.xml` (public
URLs plus active restaurants only, max 500). Private pages
(login/admin/owner/delivery/leads/track/app) MUST carry `noindex`.
Never use keyword stuffing, fake structured data, fake reviews, or
fabricated business information.

### XXII. No Fabricated Proof

Never fabricate customer logos, testimonials, ratings, businesses, or
usage claims. Every public claim MUST trace to a verifiable source.
Rationale: trust and legal safety outweigh marketing speed.

### XXIII. Preserve Restivo Visual Identity

Preserve the existing Restivo visual identity unless a future spec
explicitly requires changing it. Evolve within the system; do not
rebrand by default. Hero/marketing visuals MUST add zero extra API/DB
requests (inline emoji/CSS).

### XXIV. Reliability Over Feature Count

Optimize for reliability, maintainability, security, simplicity, customer
value, and future scalability rather than feature count. Avoid N+1,
unbounded loops, excessive payloads, and unsafe shared mutable state.
Code MUST stay correct under concurrent orders and edits.

### XXV. Tests Required; Never Weaken Tests to Pass

Every implementation MUST include appropriate tests and MUST NOT weaken
existing tests merely to make them pass. Important business logic and
security-sensitive behavior MUST have the smallest runnable check, not
only manual browser testing. Fix the code, not the expectation.

### XXVI. Verify Against Specification and Plan

After implementation, verify it actually satisfies the specification and
plan. `npm run check` (`scripts/check-syntax.js`) MUST pass with 0
failures before any deploy. Smoke `/`, `/app/`, `/restaurant/:slug`,
`/track`, login, dashboards, pricing fetch, robots, sitemap, and 404
HTML versus JSON. `node --test tests/` needs explicit
`TEST_DATABASE_URL` on a disposable DB, never prod. Never claim
production-ready merely because code changed. No deploy without explicit
user approval.

### XXVII. Flag Weak Approaches Instead of Blind Implementation

If a requested approach is technically weak, unnecessarily complex,
unsafe, or likely to create future debt, explicitly flag it instead of
blindly implementing it. Propose the simplest safe alternative and let
the requester decide. Rationale: silence compounds debt.

### XXVIII. Ask When Ambiguous

Stop and ask for clarification when a critical requirement is ambiguous
rather than inventing behavior. If behavior, schema, env, deployment, or
business rules cannot be determined safely, mark NEEDS CLARIFICATION and
wait. Do not invent semantics for checkout, money, authZ, or tenancy.

## Stack, Architecture and Security Constraints

Vanilla HTML/CSS/JS, no build, no TypeScript. Structure
`server/routes → controllers → services → parameterized SQL`,
`validators/` mass-assignment safe, `database/migrations/*.sql`
idempotent. Served by `express.static(client, {extensions:['html']})`
plus explicit `/app`, `/restaurant/:slug`, `/track`, `/resources`
routes (`site.routes.js` only for `robots.txt`/`sitemap.xml`/`/r/:slug`
301). Marketing (`/`, `/features.html`, `/pricing.html`,
`/for-*.html`, `/contact.html`, `/resources/`) static HTML.
Owner-editable pricing via `platform_settings(id=1, pricing_cents)` plus
public `GET /api/pricing` fallback plus `PATCH /api/owner/platform-pricing`.
Skeleton loader (`skeleton.css/js`) MUST paint first on every HTML page,
hide on `load` plus 3.8s fallback, with offline retry. Deploy: Wasmer
Edge `app.yaml` (`name:restaurants`, `fr-roub1`, `anybuild` remote, CDN
1h cache). DB via `DATABASE_URL` or Wasmer `DB_*` with TLS
`rejectUnauthorized:false`. `config/index.js` fails fast on weak prod
secrets or localhost DB. Logging MUST diagnose failures without leaking
credentials, tokens, or customer data.

## Development Workflow and Quality Gates

TDD for non-trivial logic (branch/loop/parser/money/security) with the
smallest runnable check. Keep changes small, isolated, revertable.
Justify complexity with a YAGNI note. `npm run check` MUST pass before
deploy. Smoke all key routes after every change. All PRs/reviews MUST
verify I–XXVIII compliance. Complexity MUST be justified.

## Governance

Constitution supersedes all other practices. Amendments require a doc
update, semantic version bump, and migration note: MAJOR for breaking
governance removals or redefinitions, MINOR for new principles or
materially expanded guidance, PATCH for wording or typo fixes. All
PRs/reviews MUST verify compliance with I–XXVIII plus Stack and Workflow
sections. Unjustified complexity or weakened tests block merge. Use
`HANDOFF.md` plus `README.md` plus `a.md` for runtime guidance; code
remains authoritative on conflict.

**Version**: 1.2.0 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-29
