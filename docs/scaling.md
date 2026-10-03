# Scaling — Current Assumptions, Limits & Triggers (Task 17, FR-019/FR-020/FR-021)

Target scale for this phase: **hundreds of businesses, ~1,000 orders/day, bursts of ~50 concurrent checkouts** on one Node.js instance + managed PostgreSQL (Wasmer Edge, `fr-roub1`).

## Subsystem classification

| Subsystem | Class | Notes |
|-----------|-------|-------|
| PostgreSQL sessions (`connect-pg-simple`) | **A — safe for multiple instances** | Shared by construction; rolling 12h TTL |
| Checkout/orders/subscriptions (parameterized SQL + `withTx`, per-business unique keys) | **A** | Correct under concurrency; add indexes only per measured query plans |
| Realtime SSE hub (`server/middleware/sse.js`) | **C — needs architectural change later** | In-process Map: events don't cross nodes, vanish on restart. Recovery = client refresh. A broker/retained mailbox only when multi-node or guaranteed delivery matters |
| Rate limiters (`server/middleware/ratelimit.js`) | **D — intentionally single-instance** | In-process counters reset on restart and diverge across nodes; acceptable at target scale. Shared store only with real multi-node |
| Image storage (`uploaded_files` BYTEA) | **D** | 2MB/file cap (`MAX_UPLOAD_MB`, hard max 5); indexed PK fetch; rides managed-PG backups (grows dump size — watch the 1 GB included storage) |
| Analytics/dashboard aggregates | **B — needs shared infra only at scale** | Single-instance reads are fine; expensive analytics must never starve checkout writes — bound time ranges, keep `limit/offset` |

## Performance targets (weak/mobile devices, throttled networks)

- Storefront menu read: 95% under 2s throttled mobile
- Guest browse → cart → checkout → trackable code: under 3 min mid-range mobile
- Order submission responsive under concurrent dashboard/analytics load
- Fix only what measurements justify; never cache ordering or subscription decisions

## Known limits

- Single instance: a deploy or crash drops SSE streams (refresh recovers) and resets rate counters
- `GET /api/restaurants` directory has no pagination — add `limit/offset` before many tenants exist
- Image bytes inflate every backup; monitor DB size vs the 1 GB plan

## Next architectural triggers

- Sustained >50 concurrent checkouts with DB contention → read/write split or connection tuning (measure first)
- Real multi-node deploy → shared rate store + realtime broker + sticky-or-shared sessions review
- DB approaching storage cap → object storage for images (justified migration, not speculative)
