# HTTP Interface Contract

JSON over `express.static`-served pages. All endpoints are existing conventions — this feature changes one validator, hardens two handlers, adds four endpoints, and adds one field to one response.

---

## Global rules (unchanged, restated because they are load-bearing)

| Rule | Enforcement |
|---|---|
| Tenant identity | From `req.user.restaurant_id` via `attachUser` only — never from params, query, or body (Constitution IX) |
| Pricing | Server-recomputed at write time. Client-sent totals, fees, and free-delivery state are ignored (`orders.service.js:284-292`) |
| Mutations | Origin-guarded, CSRF-protected, session cookie `HttpOnly` + `SameSite=Lax` |
| Errors | `{ error: { message, details? } }`; internals hidden in production |
| Images | Served from `/uploads/:subdir/:filename` with the stored MIME (`app.js:78-91`), before session middleware, `Cache-Control: public, max-age=2592000` |

---

## 1. `GET /api/restaurants/:slug/menu` — CHANGED (additive)

Public. No auth.

**Response delta** — one field added to each item:

```jsonc
{
  "items": [
    {
      "id": "uuid",
      "name": "منيو برجر",
      "price_cents": 2000,
      "image_path": "/uploads/items/<uuid>.webp",   // unchanged, still the primary
      "images": [                                    // NEW
        "/uploads/items/<uuid>.webp",                //   element 0 === image_path
        "/uploads/items/<uuid2>.webp"                //   ordered additional photos
      ],
      "options": [ /* unchanged shape */ ]
      // …all existing snake_case columns unchanged
    }
  ]
}
```

**Guarantees**

- `image_path` is present and unchanged — every existing consumer keeps working
- `images[0] === image_path` when `image_path` is non-null; `images` is `[]` when the item has no photos
- Additive only. No existing key is renamed, removed, or retyped
- Sourced from one `LEFT JOIN` in the existing items query

---

## 2. `POST /api/admin/images` — UNCHANGED (consumed by product photos)

`requireAuth` + `requireRestaurantAdmin`.

`?type=hero` and `?type=items` are both already valid — `SUBDIRS` at `upload.js:24` admits `logos|covers|items|hero`, and `PUBLIC_PATH_RE` at `files.service.js:12` matches the same set. **No new upload namespace is required for product photos.**

Multipart field name is `image`. Validation (`upload.js:52-78`): declared MIME must be in the allow-list, sniffed magic bytes must match the declared MIME, size ≤ `config.maxUploadBytes` (default 2 MB). The stored extension is **derived from the sniffed bytes**, never from the client's filename.

Responses:

| Case | Status | Body |
|---|---|---|
| `type=hero` | `201` | `{ path, heroImage }` |
| `type=items&itemId=<uuid>` | `201` | `{ path }` — replaces the item's primary image and deletes the old file |
| Disallowed format / spoofed content / bad `type` | `400` | Error envelope; the message names the accepted formats (FR-053) |
| Over size cap | `400` | Error envelope |
| Post-save failure | — | Saved file deleted so no orphan remains (`admin.controller.js:306-309`) |

---

## 3. Hero photo endpoints

| Endpoint | Change |
|---|---|
| `GET /api/admin/hero-images` | Unchanged — `{ heroImages }`, active only, ordered by `position` |
| `POST /api/admin/hero-images` | **FIXED** — validator now accepts `/uploads/(covers\|hero)/…`, so real hero paths are accepted instead of rejected |
| `PATCH /api/admin/hero-images/:imageId` | Unchanged contract; reorder semantics clarified below |
| `DELETE /api/admin/hero-images/:imageId` | **FIXED** — after removal, promotes a remaining active hero if none is primary |
| `GET /api/restaurants/:slug/hero-images` | Unchanged |

**`POST /api/admin/hero-images` request**

```jsonc
{ "imagePath": "/uploads/hero/550e8400-e29b-41d4-a716-446655440000.webp" }
```

Validation after the fix:

| Input | Result |
|---|---|
| `/uploads/hero/<uuid>.(jpg\|png\|webp)` | `201 { heroImage }` |
| `/uploads/covers/<uuid>.(jpg\|png\|webp)` | `201` (existing behaviour preserved) |
| `/uploads/logos/<uuid>.webp` | `400` — foreign namespace |
| `/uploads/hero/../secret.jpg`, any traversal | `400` |
| Non-string, wrong extension, non-UUID filename | `400` |

**`PATCH` body** — `position`, `isPrimary`, `isActive`. Owned rows only; a row belonging to another business returns `404` rather than `403`, so existence is not disclosed.

**Reorder semantics** (new, to make FR-047 keyboard-operable without collision risk): a reorder request expresses a permutation of owned hero ids. The server applies it inside one transaction using a two-phase offset so the intermediate state cannot violate `UNIQUE (business_id, position)`. Assigning a bare `position` to one row remains supported for compatibility.

**Errors**: `400` invalid payload · `401` unauthenticated · `403` not an admin of the business · `404` unknown or unowned image · `400` "Maximum N hero images" when at the platform cap (`restaurants.service.js:457-462`).

---

## 4. Owner console hero endpoints — HARDENED

`requireOwner`.

| Endpoint | Change |
|---|---|
| `POST /restaurants/:id/hero-images` | **FIXED** — the same image-upload middleware is attached, and the resulting path goes through the same validator. Previously no middleware was attached and `req.body.imagePath` was inserted unvalidated |

**This is a security fix, not a cosmetic one.** Before: `savedImagePublicPath` was always `undefined`, so an arbitrary client-supplied string landed in `business_hero_images.image_path` with no validation.

After: the handler accepts only a path produced by a validated upload, or a body path that passes the same validator. `req.body.imagePath` alone is no longer sufficient.

---

## 5. Product photo endpoints — NEW

`requireAuth` + `requireRestaurantAdmin`. Tenant-scoped to `req.user.restaurant_id`; cross-tenant access returns `404`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/menu/items/:itemId/images` | Ordered additional photos for one owned item |
| `POST` | `/api/admin/menu/items/:itemId/images` | Register a validated uploaded path as an additional photo |
| `PATCH` | `/api/admin/menu/items/:itemId/images` | Reorder — permutation of owned ids, applied transactionally |
| `DELETE` | `/api/admin/menu/items/:itemId/images/:imageId` | Remove one additional photo |

Upload itself reuses `POST /api/admin/images?type=items&itemId=<uuid>` only for the **primary** image. Additional photos upload through the same endpoint and are then registered via the `POST` above — one storage path, one validator, one allow-list.

**`POST` request/response**

```jsonc
// request
{ "imagePath": "/uploads/items/<uuid>.webp" }

// 201
{ "itemImage": { "id": "uuid", "menuItemId": "uuid", "imagePath": "/uploads/items/<uuid>.webp", "position": 0 } }
```

`position` is assigned server-side as the next value in the set; clients never supply it.

**Validation** — `400` when `imagePath` fails the `/uploads/items/<uuid>.(jpg|png|webp)` pattern, or when the item is not owned by the caller's business.

**Reorder request** — `{ "order": ["<id-a>", "<id-b>", "<id-c>"] }`. The server validates that every id is owned by the caller and that the set matches exactly, then applies the permutation in one transaction using a temporary offset.

---

## 6. Free delivery — UNCHANGED

No endpoint change. Already correct and already covered by 9 tests.

| Surface | Location |
|---|---|
| Read/write | `PATCH /api/admin/settings` — `freeDeliveryEnabled`, `freeDeliveryThresholdCents` (`settings.service.js:56-57`; validated `validators/index.js:218-221`) |
| Public exposure | `settings.freeDeliveryEnabled` + `settings.freeDeliveryThresholdCents` in the menu payload (`restaurants.service.js:240-241`) |
| Enforcement | `orders.service.js:284-292` — recomputed from the server-loaded subtotal; delivery only; pickup never charged; threshold inclusive |

Presentation-only work in this feature: the storefront progress state (FR-037) and the dashboard's disabled-when-off affordance (FR-039).

---

## 7. Dashboard authentication & capabilities — UNCHANGED

No authorization logic is touched (FR-043). Sections hidden by plan entitlement, capability, or business type must continue to be rejected server-side on every request; hiding them in the browser is not protection. Contract unchanged.

---

## 8. Unchanged surfaces (explicit non-regression list)

Every endpoint below is untouched and must continue to pass its existing tests:

onboarding · login/signup/logout · session · password reset · menu & category CRUD · item CRUD · option group & choice CRUD · cart (client-held, server-repriced at checkout) · guest checkout · order lifecycle & status transitions · order tracking · bookings · delivery groups · delivery-user dashboards · analytics · web push & SSE · subscriptions & trials · capabilities · translations · platform pricing · leads · offers · SEO endpoints · robots.txt · sitemap.xml · image serving