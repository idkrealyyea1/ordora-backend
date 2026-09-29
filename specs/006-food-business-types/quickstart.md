# Quickstart: Food Business Types (Task 2)

**Feature**: `specs/006-food-business-types/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

## Prerequisites

- Task 1 implemented in the working tree (migration `021`, plumbing, owner form, foundation tests).
- Remote PostgreSQL connection string and seed credentials per project README (never commit secrets). Node >= 20, dependencies installed.

## Validate end to end

1. **Migrate**: run the existing migration runner; confirm schema current (no new migration in this task) and legacy rows read as `restaurant`.
2. **Dashboards show type**: in the owner console list/detail and the admin dashboard, confirm the business type is displayed; open any customer storefront and confirm no type badge or label appears.
3. **Six-kind ordering**: create one business per required kind (restaurant, cafe, bakery, dessert shop, home kitchen, cloud kitchen) via the owner flow and place a guest order on each through the shared flow.
4. **Owner-only lock**: as a tenant admin, submit a settings update carrying a type value and confirm the stored type is unchanged; as platform owner, change a type and confirm only future capability behavior follows it, with orders/users/menu/settings intact.
5. **Negative paths**: unsupported type value rejected at create and update; closed/inactive/expired businesses refuse ordering; cross-type access denied both directions.
6. **Regression gates**: `npm run check` passes with 0 failures; full suite green against an explicit disposable test database only, never production.

## References

- Dashboard deltas: `contracts/dashboard-contract.md`
- Task 1 public deltas: `specs/005-food-business-foundation/contracts/`
- Decisions and rejected alternatives: `research.md`
