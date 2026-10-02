# Quickstart: Owner Web Push

**Feature**: `specs/012-owner-web-push/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

Proves real end-to-end owner push with SSE preserved. Disposable database for automated parts; real keys + real device/browser for the manual production pass. Never run against production data for tests.

## Prerequisites

```bash
npm ci
cp .env.example .env   # no real keys in repo; test keys only in local .env
createdb push_test
export TEST_DATABASE_URL=postgresql://localhost:5432/push_test
node database/migrate.js   # 025 + 026 apply; re-runnable no-op
npm run check              # 0 failures required
```

Test-only VAPID keys (NEVER production keys, NEVER committed):

```bash
# generate once locally, keep in .env (gitignored)
node -e "console.log(require('web-push').generateVAPIDKeys())"
# .env: VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@example.com PUSH_ENABLED=1
```

## Automated validation (stubbed sender)

```bash
TEST_DATABASE_URL=$TEST_DATABASE_URL node --test tests/push-notifications.test.js
```

Expect: subscription CRUD + upsert; 401 logged-out; 403 staff; cross-tenant 404s; multi-device fan-out one-per-subscription; replay dedup zero-duplicates; dead-endpoint deactivation; push-down checkout still 201; SSE `order:new` fires with push enabled AND broken; payload contains no customer PII.

## Manual production checklist (real keys, real browser/device)

1. Configure production env (`VAPID_*`, `PUSH_ENABLED=1`, contact subject); verify settings show push available (not the unavailable state).
2. Dashboard settings → notifications card: benefit text → tap enable → browser prompt → grant → device appears in list. Repeat deny path on a second profile: calm guidance, no loops.
3. Close the dashboard tab (browser backgrounded). Place a guest order from another device → system notification with new-order meaning + code + business name within ~30s.
4. Tap the notification → dashboard order view opens/focuses on the right business.
5. Dashboard open + subscribed: place order → SSE highlight behaves exactly as before AND push arrives; replay the event → no duplicate push.
6. Two devices subscribed → both notify. Remove one → it stops; the other continues.
7. Revoke permission / dead endpoint → next order skips it silently; row deactivated; everything else delivered.
8. Disable keys (`PUSH_ENABLED=0`) → checkout 201s, SSE fires, settings show unavailable-with-guidance.
9. Second business observer: receives nothing on either channel for the first business's orders.
10. AR + EN walkthrough of the whole settings flow on a phone viewport.

## Regression gates

```bash
TEST_DATABASE_URL=$TEST_DATABASE_URL node --test tests/
```

`notifications-foundation`, `operations-board`, tenant-isolation, and all legacy suites stay green; no test weakened to pass.
