# Phase 1 — Data Model

One additive migration. No existing column is altered, dropped, or retyped. Every existing business continues to behave identically without configuration.

---

## 1. `menu_item_images` (NEW)

An ordered **additional** photo set for a menu item. The item's primary image remains `menu_items.image_path` and is *not* duplicated here.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK, `DEFAULT gen_random_uuid()` | |
| `restaurant_id` | `UUID` | `NOT NULL`, FK → `restaurants(id)` `ON DELETE CASCADE` | Denormalised from `menu_items` for tenant-scoped queries, matching the `option_choices` precedent (`023_item_options.sql:36-53`) |
| `menu_item_id` | `UUID` | `NOT NULL`, FK → `menu_items(id)` `ON DELETE CASCADE` | |
| `image_path` | `TEXT` | `NOT NULL` | Must match `/^\/uploads\/items\/[0-9a-f-]{36}\.(jpg\|png\|webp)$/` (FR-052) |
| `position` | `INTEGER` | `NOT NULL DEFAULT 0`, `CHECK (position >= 0)` | Ordering within the set; `>= 1` in practice so element 0 of the merged array is always `image_path` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | `updated_at` trigger, following `031_business_hero_images.sql:29-37` |

**Constraints**

- `UNIQUE (menu_item_id, position)` — prevents ambiguous ordering within one set
- Index `(menu_item_id, position)` for the ordered read
- Index `(restaurant_id)` for tenant-scoped listing

**Backward compatibility contract**: an item with zero rows here behaves exactly as today. The merged public array is `[image_path]` plus the ordered set, and `image_path` may be `NULL` — in which case the merged array is just the set, or empty.

### Migration notes

- File: `database/migrations/035_menu_item_images.sql`
- Must be idempotent in the style of the existing set: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`, and `pg_constraint`-style guards as used in `031:23-28`
- Applied by `database/migrate.js:32-45` — filename-keyed `schema_migrations` ledger, one transaction per file, rollback on failure
- **No backfill.** No row is required for existing businesses. This is what keeps the change backward compatible
- `tests/helpers.js:39-42` truncates a fixed table list between suites — **`menu_item_images` must be added to it**, or cross-suite leakage will occur

---

## 2. Entities carried forward unchanged

Confirmed by inspection; documented so the plan's non-regression claim is checkable rather than asserted.

### `menu_items`

Single nullable `image_path TEXT` — the primary image. Eight consumers depend on it and none is modified (`menu.service.js:14,33,86,89,119,137`; `restaurants.service.js:195`; `admin.controller.js:302`; storefront `dishCard`/`renderSheet`). Sole read in `client/js/restaurant.js:624` for card images.

### `business_hero_images`

`id`, `business_id` (FK, cascade), `image_path`, `position`, `is_primary`, `is_active`, timestamps. From `031_business_hero_images.sql:6-21`.

Two constraints are relevant to this feature:

- `UNIQUE (business_id, position)` — the cause of Defect 1
- `UNIQUE (business_id) WHERE is_primary = true` (partial, line 21) — guarantees at most one primary

**Soft-delete invariant that is currently violated**: `removeHeroImage` sets `is_active = false` but keeps `position` and does not reassign `is_primary`. So a business can be left with no primary hero. The fix reassigns a remaining active hero.

### `restaurant_settings` — free delivery

Already exists from `034_free_delivery.sql:3-6`:

- `free_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `free_delivery_threshold_cents INTEGER NOT NULL DEFAULT 0 CHECK (>= 0 AND <= 1000000)`

**No migration needed.** Already enforced server-side at `orders.service.js:284-292` and already publicly exposed at `restaurants.service.js:240-241`. This feature only improves presentation and dashboard affordances (FR-037, FR-039).

### `uploaded_files`

`path`, `mime`, `bytes`, `size_bytes` from `003_uploaded_files.sql`. Images are `bytea` in PostgreSQL, never ephemeral disk. `PUBLIC_PATH_RE` (`files.service.js:12`) already admits the `items` namespace, so product photos need no new namespace or storage change.

### Not added, deliberately

| Rejected entity | Why |
|---|---|
| Category photographs | Deferred. No business stores any image, so photo-filled circles would render empty (research.md R-004). FR-015 permits this as a future enhancement |
| Product nutrition / ingredient / allergen fields | FR-029 forbids displaying what does not exist; adding columns would invite fabricated content (Principle XXII) |
| Product photo ordering separate from `position` | `position` already covers it; a second ordering column would be duplication |

---

## 3. State transitions

### Hero photo lifecycle (fixed by this feature)

```text
            ┌──────────┐
            │  absent  │
            └────┬─────┘
                 │ add (validates path, assigns position,
                 │       position 0 and is_primary if first)
                 ▼
            ┌──────────┐  remove   ┌───────────┐
            │  active  │──────────▶│ inactive  │
            └────┬─────┘           │ (soft)    │
                 │                 └─────┬─────┘
                 │ set_primary            │ position retained, never reused
                 ▼ (partial unique index) │
            exactly one primary          │
                                           │ reactivation not offered in v1
```

**Invariant 1**: `MAX(position)` is computed over **all** rows including inactive, so a new photo never collides with a soft-deleted one.

**Invariant 2**: after any removal, if an active hero remains and none is primary, one is promoted.

**Invariant 3**: reordering swaps positions within the owned set rather than assigning a bare position, so a swap cannot transiently violate `UNIQUE (business_id, position)`.

### Product photo lifecycle (new)

```text
        item created (image_path may be NULL)
                 │
                 ▼
     ┌───────────────────────┐
     │ 0 additional photos   │◀── default for every existing business
     └───────┬───────────────┘
             │ add photo (upload → path validated → position = next)
             ▼
     ┌───────────────────────┐
     │ 1..n additional photos│
     └───────┬───────────────┘
             │ reorder (swap positions) / remove
             ▼
     merged public array = [image_path] ++ ordered set
```

**Invariant**: `image_path` is never written by photo-set operations. Only the existing `type=items` single-image replace path (`admin.controller.js:299-305`) writes it, exactly as today.

---

## 4. Public menu payload change

`GET /api/restaurants/:slug/menu` → `restaurants.service.js:175-254`. Items currently expose raw snake_case SQL columns plus an injected `options` array (`restaurants.service.js:207`).

**Additive change only** — `image_path` remains present and unchanged:

```text
items[] += { images: [ string, ... ] }   // element 0 is image_path when non-null,
                                         // followed by the ordered additional set
```

Single `LEFT JOIN` in the existing items query, ordered by position. No per-item request (Principle XXIV). Items with no photos yield an empty array, which the storefront renders as today's single-image presentation.

**Key consistency note**: the menu payload already camel-cases hero images to `{ imagePath, position, isPrimary }` (`restaurants.service.js:244`) while the dedicated hero endpoint returns raw snake_case `image_path`/`is_primary` (`restaurants.service.js:439`). The new `images` array is a flat string list and sidesteps this pre-existing inconsistency rather than extending it.