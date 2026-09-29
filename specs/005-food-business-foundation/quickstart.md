# Quickstart: Food Business Foundation

**Feature**: `specs/005-food-business-foundation/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

## Prerequisites

- Remote PostgreSQL connection string and seed credentials configured per project README (never commit secrets).
- Node >= 20 with dependencies installed.

## Validate end to end

1. **Migrate**: run the existing migration runner; confirm `021` applies idempotently (re-run is a no-op) and existing restaurants read as `business_type = restaurant`.
2. **Seed + boot**: create the platform owner, start the app, log in to `/owner.html`.
3. **Create a bakery**: via the owner console with type `bakery` and a non-USD currency; confirm it appears in the public directory and `/restaurant/<slug>` renders with prices formatted in its currency.
4. **Guest order**: place pickup and delivery guest orders on both the old restaurant and the bakery; confirm server-side totals, price snapshots, tracking codes, and dashboard handling match pre-feature behavior.
5. **Negative paths**: unknown `business_type` → 400; invalid currency → 400; delivery where disabled → clear refusal with pickup intact; closed/inactive/expired → same safe refusal as today.
6. **Isolation**: as tenant A, attempt every read/write path into tenant B (items, categories, orders, uploads, query-param spoofing, owner endpoints) — all denied; repeat reversed.
7. **SEO/identity**: confirm `robots.txt`, `sitemap.xml` (static + ≤500 active), private-page `noindex`, unchanged visual identity, and zero fabricated proof.
8. **Regression gates**: `npm run check` passes with 0 failures; full suite runs green against an explicit disposable test database only (`TEST_DATABASE_URL`), never production.

## References

- Contract deltas: `contracts/public-contract.md`, `contracts/admin-owner-contract.md`
- Decisions and rejected alternatives: `research.md`
