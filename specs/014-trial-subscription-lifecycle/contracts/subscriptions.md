# Contract: Subscriptions (platform-admin management + reads)

**Auth**: mutation endpoints are platform-`owner` only; restaurant owners can only read their own subscription (tenant from session, never from the request). Every mutation writes one `subscription_events` row in the same transaction (actor, before/after state and plan, old/new expiration, reason, timestamp). Client-sent plan/state/expiry/capability fields from non-admin callers are rejected, never honored.

## GET /api/onboarding/subscription — owner reads own status

Session tenant. Success `200`:

```json
{
  "state": "trial",
  "plan": { "key": "standard", "name": "Standard" },
  "trialEndsAt": "2026-10-09T00:00:00.000Z",
  "periodEndsAt": "2026-10-09T00:00:00.000Z",
  "daysLeft": 5,
  "graceUntil": null,
  "messageKey": "sub_trial_left"
}
```

- `messageKey` resolves through the existing DICT (`ar`+`en` human-readable copy; no internal terminology).
- `daysLeft` is computed from server time; `null` ends (grandfathered) report the active message variant.

## GET /api/owner/restaurants/:id/subscription — admin reads one business

Explicit UUID target (IDOR-safe: platform role + validated id). Success `200`: full record (state, plan key/name, trial/period/grace/cancel/suspend instants, history URI).

## POST /api/owner/restaurants/:id/subscription/activate — assign plan + period

Body: `{ planKey, periodEndsAt?, reason? }` (`periodEndsAt` omitted = no end date, i.e. open-ended active).

Success `200`: the updated record + the audit row id. Transitions validated (e.g. expired→active, suspended→active, trial→active); invalid ones → `409 INVALID_TRANSITION`. Errors: `400` validation · `404` unknown business/plan · `403` non-admin.

## POST /api/owner/restaurants/:id/subscription/extend — extend trial or period

Body: `{ extendDays?, newEndsAt?, reason? }` (exactly one of the two). Extends from later-of(now, current end) — paid days are never lost.

Success `200`: updated record. Trial extension allowed only from trial/grace rooted in a trial; otherwise `409 INVALID_TRANSITION`.

## POST /api/owner/restaurants/:id/subscription/cancel — cancel now or at period end

Body: `{ effective: "now" | "period_end", reason? }` (default `period_end`). `period_end` keeps full access until the paid-through instant, reversible by re-activation before then.

Success `200`: updated record showing `cancelEffectiveAt`.

## POST /api/owner/restaurants/:id/subscription/suspend — suspend with reason

Body: `{ reason }` (required, non-empty). Success `200`: state `suspended`; storefront shows the controlled notice, ordering blocked, nothing deleted.

## POST /api/owner/restaurants/:id/subscription/reactivate — return to active

Body: `{ reason? }`. Valid from `suspended`, `expired`, `grace`, and pre-effective `cancelled`; anything else → `409 INVALID_TRANSITION`.

## GET /api/owner/restaurants/:id/subscription/events — audit trail

Success `200`: `{ events: [{ id, actor, action, oldState, newState, oldPlan, newPlan, oldEndsAt, newEndsAt, reason, at }] }` newest first. No events are ever mutated by later calls.
