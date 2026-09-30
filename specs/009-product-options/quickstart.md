# Quickstart: Product Options (Task 5)

**Feature**: `specs/009-product-options/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

## Prerequisites

- Tasks 1–4 implemented in the working tree. Remote PostgreSQL connection string and seed credentials per project README (never commit secrets). Node >= 20, dependencies installed.

## Validate end to end

1. **Migrate**: run the existing runner; confirm `023` applies idempotently and option-free products/orders read exactly as before.
2. **Define**: as a tenant admin, create a required single-pick replace group (sizes), an optional multi-pick adjust group (toppings), and a quantity extra; confirm another business sees none of them.
3. **Order each kind**: guest-checkout a sized product, an add-on product, and a multi-choice product; confirm cart, confirmation, tracking, and dashboards show selections with correct currency-priced totals.
4. **Enforce**: submit without a required pick, over max picks, unknown/wrong-tenant options, and client-priced choices; confirm rejection or server-computed correction in every case.
5. **Freeze**: edit and delete definitions after ordering; re-track old orders and confirm complete original selections with original prices.
6. **Regression gates**: `npm run check` passes with 0 failures; full suite green against an explicit disposable test database only, never production.

## References

- Contract deltas: `contracts/options-contract.md`
- Decisions and rejected alternatives: `research.md`
