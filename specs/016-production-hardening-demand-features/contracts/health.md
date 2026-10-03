# Contract: Liveness & Readiness

## Liveness — `GET /api/healthz` (unchanged)

- `200 → {ok:true}`, no database touch, no secrets, no tenant data.
- Probed by the hosting platform (`app.yaml` instaboot) and safe to cache briefly.

## Readiness — `GET /api/readyz` (new)

- Runs a bounded `SELECT 1` against the pool (statement timeout ~2s).
- `200 → {ok:true, checks:{db:"up"}}` when the database answers.
- `503 → {ok:false, checks:{db:"down"}}` when it does not; body contains no connection string, credentials, host, or tenant data.
- Rate limits: the global API limiter (300/15min) leaves ample headroom for platform probes; no limiter bypass needed.

## Deployment wiring

- Router sends traffic only when readiness passes; liveness restarts only a dead process.
- Smoke test after deploy hits both: liveness first, then readiness, then the page/API smoke list.
