# Contract: Service Worker Push (client)

**Base**: `client/sw.js` (offline shell) + `client/js/pwa.js` (registration). Cache/fetch logic unchanged; cache name bumped per existing convention so updated workers activate.

## Added handlers (additive only)

- `push` event: parse payload (title/body/tag/url); `showNotification(title, { body, tag, icon, badge, data: { url } })`. Malformed payload → generic new-order fallback notification, never a crash, never silent drop without record where possible.
- `notificationclick` event: close the notification; focus an open dashboard client if present, else `clients.openWindow(url)` (dashboard order view). No duplicate tabs where the platform allows focusing.
- No other worker behavior changes: navigations stay network-first, statics cache-first, `/api/` + `/uploads/` never cached.

## Deep-link target

- `url` points at the dashboard orders surface for the owning business (same `/admin.html` orders view the SSE highlight uses). No order data in the URL beyond what the authenticated dashboard already resolves server-side.
