# Contract: Advanced-Feature Evidence Template (Task 18)

One record per candidate feature, stored as a section in `docs/advanced-feature-evidence.md`. No database table, no feedback platform.

## Fields

| Field | Question it answers |
|-------|---------------------|
| Problem | What real problem does it solve, for whom? |
| User | Which persona (customer, owner, platform operator) and which business types? |
| Evidence | What proves demand (requests, drop-off data, repeated manual work, usage, churn, revenue)? `none-observed` is a valid, honest value |
| Value | What measurable business/customer value could it create? |
| Complexity | What must change (schema, API, UI, tests, docs)? |
| Risk | What can it break (ordering, tenancy, subscriptions, simplicity)? |
| Dependencies | Which existing systems must change? |
| Maintenance | What ongoing burden does it create? |
| Scalability | Query/storage/payload/mobile impact at the clarified scale? |
| Monetization | Does it change subscription value or plan mapping? Through `capabilities.service.js` only |
| Simplicity | Does progressive disclosure keep basic merchants unaffected? How? |
| Verdict | `ship` (with capability key + rollout note) or `defer` (with the trigger metric that reopens it) |

## Initial candidates to evaluate (from the roadmap text, possibilities only)

1. Customer reorder of a past order
2. Promotions / coupons
3. Basic loyalty (e.g. order-count reward)

Default expectation: `defer` with trigger metrics, unless live evidence in the repo clearly passes the gate — the record must show its work either way.
