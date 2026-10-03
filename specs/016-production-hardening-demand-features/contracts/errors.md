# Contract: Error Envelope (verify-only)

Existing `server/utils/errors.js` envelope is retained; this contract pins its production behavior so Task 17 verification has a fixed target.

## Shape

```json
{ "error": { "code": "STRING_CODE", "message": "safe human-readable message" } }
```

## Code table

| Code | When | HTTP |
|------|------|------|
| validation error (`INVALID_*`, malformed key, bad input) | trust-boundary rejection | 400 |
| `UNAUTHORIZED` | missing/invalid session | 401 |
| `FORBIDDEN`, `NO_RESTAURANT`, `SUBSCRIPTION_EXPIRED`, `CAPABILITY_UNAVAILABLE`, `STAFF_NO_*` | denied | 403 |
| `NOT_FOUND` | unknown order/code/resource (no existence oracle) | 404 |
| `INVALID_STATUS_TRANSITION`, `INVALID_TRANSITION`, `ITEMS_UNAVAILABLE` | conflict | 409 |
| `RATE_LIMITED` | limiter hit | 429 |
| dependency failure (`DB_UNAVAILABLE`, migration failure surfaced) | downstream down | 503 |
| unexpected | anything else | 500 |

## Rules

- Production bodies never contain stack traces, SQL, paths, secrets, or tokens; full diagnostics go to the server-side trace only.
- Order-tracking and login failures use `NOT_FOUND` / generic messages to avoid user-enumeration or order-existence oracles.
- New codes introduced by this phase (`DB_UNAVAILABLE` for startup/readyz surfacing) follow the same shape.
