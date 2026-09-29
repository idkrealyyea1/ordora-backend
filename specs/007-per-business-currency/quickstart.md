# Quickstart: Per-Business Currency (Task 3)

**Feature**: `specs/007-per-business-currency/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

## Prerequisites

- Tasks 1–2 implemented in the working tree. Remote PostgreSQL connection string and seed credentials per project README (never commit secrets). Node >= 20, dependencies installed.

## Validate end to end

1. **Migrate**: run the existing runner; confirm `022` applies idempotently and every historical order backfills the currency its business shows today (re-run is a no-op).
2. **Legacy untouched**: replay ordering, tracking, dashboard, analytics, and export checks on a pre-Task-3 business with zero difference and zero data repair.
3. **Owner selection**: as business admin, pick each prepared code and confirm all surfaces present in it; submit a malformed code and confirm rejection with the stored value intact.
4. **No-conversion proof**: record all stored numerics, change currency, and confirm every stored value is bit-identical while display follows the new code.
5. **History preservation**: place an order, change currency, re-track it — original values and original currency context shown; new orders use the new context.
6. **Aggregates**: confirm per-currency grouping in platform/owner figures with no unlabeled mixed totals.
7. **Regression gates**: `npm run check` passes with 0 failures; full suite green against an explicit disposable test database only, never production.

## References

- Contract deltas: `contracts/currency-contract.md`
- Decisions and rejected alternatives: `research.md`
