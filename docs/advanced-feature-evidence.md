# Advanced-Feature Evidence & Decision Record (Task 18, FR-023)

> Rule: no candidate ships schema, API, or UI in this phase unless its record
> shows a clear pass. Every verdict is `ship` (with capability key + rollout
> note) or `defer` (with the trigger metric that reopens it). All shipped
> behavior resolves through `server/services/capabilities.service.js` —
> never scattered plan-name checks.

## Template (copy per candidate)

- Problem: / User: / Evidence: / Value: / Complexity: / Risk: /
  Dependencies: / Maintenance: / Scalability: / Monetization: /
  Simplicity: / Verdict:

## Candidate 1 — Customer reorder of a past order

- Problem: repeat customers re-enter the same cart every time.
- User: customers of bakeries/cafes with habitual orders; all business types.
- Evidence: none-observed (no reorder telemetry, no feedback store, no repeated-request log in-repo).
- Value: faster repeat checkout; unmeasured.
- Complexity: low-medium (order → cart prefill; tenant + availability re-validation required).
- Risk: low (read-only prefill, checkout path unchanged).
- Dependencies: cart, menu availability, tracking codes.
- Maintenance: small (prefill mapping).
- Scalability: negligible (no new queries beyond menu read).
- Monetization: none (available to all entitled types via `orders` capability).
- Simplicity: high (one button, no merchant config).
- Verdict: **defer** — reopen when tracking-page analytics or owner requests show repeat-order demand.

## Candidate 2 — Promotions / coupons

- Problem: owners want discounts without editing every price.
- User: restaurant owners running campaigns.
- Evidence: none-observed.
- Value: campaign flexibility; unmeasured.
- Complexity: medium (coupon model, server-side price math changes, entitlement mapping, abuse limits).
- Risk: medium-high (touches checkout money math — the most sensitive path).
- Dependencies: checkout pricing, capabilities, analytics.
- Maintenance: ongoing (code lifecycle, misuse support).
- Scalability: extra checkout queries per order.
- Monetization: likely plan-differentiated (new capability key required).
- Simplicity: medium (merchant must understand codes, limits, expiry).
- Verdict: **defer** — reopen when owners request discounts repeatedly or churn reasons cite it.

## Candidate 3 — Basic loyalty (order-count reward)

- Problem: retain regulars without third-party tools.
- User: cafes/bakeries with regulars.
- Evidence: none-observed.
- Value: retention; unmeasured.
- Complexity: medium (counters, reward rules, fraud/abuse surface).
- Maintenance: ongoing (rule disputes, fraud review).
- Scalability: per-order counter writes.
- Monetization: likely plan-differentiated.
- Simplicity: medium (merchant config + customer explanation).
- Verdict: **defer** — reopen with the same triggers as Candidate 2.

## Phase verdict

Framework built; all three initial candidates **deferred pending evidence**.
No schema, API, or UI ships for any candidate in this phase.
