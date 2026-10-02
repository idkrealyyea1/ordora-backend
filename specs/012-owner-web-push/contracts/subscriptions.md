# Contract: Push Subscriptions (owner settings)

**Base**: session auth + `requireRestaurantAdmin` chain on `admin.routes.js`; push routes add a stricter admins-only check (staff → 403) without changing existing guards.

## Endpoints (all JSON, all authenticated)

- `GET /api/admin/push-public-key` → `{ enabled: bool, publicKey: string|null }`. `enabled` mirrors server `PUSH_ENABLED` (keys configured). No subscription required.
- `GET /api/admin/push-subscriptions` → `{ subscriptions: [{ id, label, createdAt }] }` for the session business only.
- `POST /api/admin/push-subscriptions` body `{ endpoint, keys: { p256dh, auth }, label? }` → `201 { subscription: { id } }`. Upsert on `endpoint`: update keys/label, set `is_active = TRUE`, rebind `restaurant_id` to the session tenant.
- `DELETE /api/admin/push-subscriptions/:id` → `{ ok: true }` scoped to the session business (unknown/other-business id → 404, identical response).

## Validation & limits

- Endpoint must be HTTPS URL ≤ 2000 chars; keys valid base64url, non-empty, capped; label plain text ≤ 60 (default `''`). Failures → `400` with field detail.
- Staff sessions → `403` on all four endpoints. logged-out → `401`. Mutating endpoints rate-limited consistent with existing admin writes.
- VAPID private key never appears in any request/response/log.

## Subscription capture (client, settings card)

1. Capability check (`Notification`, `PushManager`, SW) → render supported/unavailable state.
2. User taps enable → `Notification.requestPermission()` → if granted, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` with the public key from `push-public-key` → POST subscription → show in device list.
3. Denied → guidance state (browser-settings re-enable steps, SSE-still-works note). No re-prompt loops.
