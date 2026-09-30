# Quickstart: Ordering Journey (Tasks 6–8)

**Feature**: `specs/010-ordering-journey/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

## Prerequisites

- Tasks 1–5 implemented in the working tree. Remote PostgreSQL connection string and seed credentials per project README (never commit secrets). Node >= 20, dependencies installed.

## Validate end to end

1. **Migrate**: run the existing runner; confirm `024` applies idempotently and normal products read with pre-order off.
2. **Pre-order truth**: enable pre-order with a message on one product; confirm badge, explanation, cart note, frozen snapshot, and timeline annotation; disable mid-cart and confirm stale claims refused.
3. **Full journey**: per business type, complete link-to-tracked-order guest checkout with a mixed cart and currency-correct totals.
4. **Robustness**: double-submit, retry, and replay (one order each); tampered prices/options (neutralized); injected validation/DB failure (no partial orders).
5. **Lifecycle**: walk every valid transition with dashboard/SSE/timeline agreement; attempt every invalid jump plus terminal edits and repeats (all refused or safe).
6. **Regression gates**: `npm run check` passes with 0 failures; full suite green against an explicit disposable test database only, never production.

## References

- Contract deltas: `contracts/journey-contract.md`
- Decisions and rejected alternatives: `research.md`
