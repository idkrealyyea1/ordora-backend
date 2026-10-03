# Phase 0 Research

All unknowns below were resolved by direct inspection of code, migrations, tests and configuration. No question remains open. Every claim carries file:line evidence.

---

## R-001 — Token consolidation boundary

**Question**: One shared token source, or harmonise the three existing sets?

**Decision**: One new universal stylesheet, `client/css/tokens.css`, loaded by all 21 pages. Per-surface files keep component rules but stop declaring tokens.

**Rationale**: The CSS load matrix proves a universal-file pattern already exists and is cheap — `/fonts/fonts.css` is loaded by all 21 pages. So does `style.css` (17 pages) and `restivo.css` (exactly 2: `index.html`, `restaurant.html`). There is therefore no structural obstacle and an existing precedent.

| File | Pages loading it | Token role |
|---|---|---|
| `client/css/style.css` | 17 | Large dashboard/marketing set (`--primary`, `--surface`, `--radius`, `--shadow`, `--font-*`) |
| `client/css/restivo.css` | 2 (`index.html`, `restaurant.html`) | Brand primitives (`--cream`, `--sand`, `--ink`, `--teal`, `--coral`, `--yellow`, `--paper`, `--line`) plus `--sf-*` |
| `client/css/marketing.css` | 8 | `--mk-max`, `--mk-pad` |
| `client/css/offers.css` | 2 | `--oh-accent`, `--oh-ink` |
| `client/css/storefront.css` | **0** | Dead — 533 lines, no HTML references it |

**Alternatives considered**: (a) Harmonise values in place — rejected because three sources are precisely why surfaces drift; nothing structurally prevents a fourth. (b) Inline tokens into `style.css` and load it on the storefront — rejected because that would pull a 957-line dashboard stylesheet onto the customer-facing menu, directly conflicting with SC-014 (page weight must not increase).

**Brand vs. static token split**: `client/js/api.js:207-224` `theme.buildTokens(primaryColor, secondaryColor)` already computes `--primary`, `--secondary`, `--primary-dark/light/soft`, `--secondary-dark/soft`, `--on-primary`, `--on-secondary` from a tenant's two configured colours and injects them onto `document.documentElement`. Call sites: `restaurant.js:255`, `restaurant.js:1103`, `admin.js:1380`.

Therefore `tokens.css` owns **static** tokens only (base palette, spacing, type scale, radii, elevation, motion, layers). The runtime brand overlay continues to own the per-tenant keys. This split needs no CSP change: `styleSrc: ["'self'", "'unsafe-inline'"]` (`server/app.js:47`) permits a same-origin `<link>`.

**Additional finding**: `admin.js:1380` only *reads* `--on-primary` to colour a label — it never applies the full brand token map to the dashboard root. FR-069 requires brand consistency across surfaces, so the dashboard must apply the same map. `restaurant.js:1103` already does.

---

## R-002 — The reported upload bug is already fixed; four other defects are live

**Decision**: Fix the four verified defects. Do not "fix" the already-fixed one.

**Rationale**: The literal string `Unsupported image type` appears in no source file. The only mention is the comment at `tests/hero-upload.test.js:6`. Commit `08d495e` ("fix: allow hero uploads + regression tests", already in HEAD) changed exactly two tokens:

- `server/middleware/upload.js:24` — added `'hero'` to `SUBDIRS`
- `server/services/files.service.js:12` — added `hero` to `PUBLIC_PATH_RE`

The user's report is therefore stale, or they are hitting a different 400. Four genuine defects remain:

### Defect 1 — add-after-remove fails on a unique-constraint collision

- `database/migrations/031_business_hero_images.sql:16` — `UNIQUE (business_id, position)`
- `restaurants.service.js:496-502` `removeHeroImage` — soft-deletes (`is_active = false`) and **keeps** the row and its position
- `restaurants.service.js:467` — computes the next position as `MAX(position) + 1` over rows `WHERE is_active = true` only

So remove-then-upload reuses a position and raises `23505 unique_violation`, surfacing as a 5xx.

**Fix**: one-line change — drop `AND is_active = true` from the `MAX` subquery at `restaurants.service.js:467` so the maximum is taken over all rows. No migration, no constraint change.

**Duplicate to fix in the same place**: `server/controllers/admin.controller.js:295-297` recomputes the same `MAX` over active rows for `type=covers`. Both call sites must be corrected together, or the bug survives on one path.

**Related gap**: removing the primary hero leaves the business with no primary — `isPrimary` defaults to `cnt === 0` (`restaurants.service.js:463`), so a subsequent add is not primary either. `removeHeroImage` should promote a remaining hero.

**Also noted**: `updateHeroImage` (`restaurants.service.js:477-494`) sets `position` directly, so a naive reorder can collide with a sibling's position. Reordering must swap rather than assign.

### Defect 2 — the add-by-path route rejects every real hero path

- `server/validators/index.js:783-788` `validateHeroImagePath` matches only `/^\/uploads\/covers\/.../`
- But `server/middleware/upload.js:71` produces `/uploads/hero/...`

So `POST /api/admin/hero-images` (`admin.routes.js:80` → `admin.controller.js:458-462`) **always** rejects a real hero path. **Confirmed by a test that locks in the bug**: `tests/test-hero-images.js:6-11` asserts the same covers-only regex and asserts `/uploads/logos/...` is rejected.

**Fix**: widen the regex to `/^\/uploads\/(covers|hero)\/[0-9a-f-]{36}\.(jpg|png|webp)$/`, and correct the test to match — preserving its real intent (reject traversal, reject foreign namespaces) rather than deleting it. Satisfies FR-081, which permits correcting an expectation that encodes an incorrect behaviour.

### Defect 3 — the owner console inserts an unvalidated path

- `server/routes/owner.routes.js:65` — `router.post('/restaurants/:id/hero-images', requireOwner, owner.addHeroImage)` — **no upload middleware attached**
- `server/controllers/owner.controller.js:613-616` — `const imagePath = req.savedImagePublicPath || (req.body && req.body.imagePath)`

`req.savedImagePublicPath` is therefore always `undefined`, so the value always falls through to `req.body.imagePath`, which passes through **no validator at all** straight into `business_hero_images.image_path`. This is a genuine security defect (Principle X), and it is why FR-054 exists.

**Fix**: attach the same image-upload middleware used by the admin route and validate the resulting path identically. The owner console UI (`client/js/owner.js:632-657`) must then upload rather than post a raw path.

### Defect 4 — the dashboard picker does not fire on selection

- `admin.js:1290-1295` — `.hero-add` zone, `#hero-upload-btn`, hidden `#hero-file` input
- `admin.js:1321-1323` — clicking `.hero-add` calls `heroFile.click()`
- `uploadHero` reads `document.getElementById('hero-file').files[0]` at `admin.js:1475`
- **No `change` listener exists on `#hero-file` anywhere in the file** (grep for `hero-file` returns only lines 1295, 1323, 1475, 1482)

So the owner picks a file and nothing happens; the upload only fires if they click the `+` button again. `hero-file.value` is cleared only on success (`admin.js:1482`), so a retry after a failure re-selects nothing.

**Fix**: bind `change` on `#hero-file` to `uploadHero`, and make the click handler delegate to the button. Satisfies FR-045 ("exactly one selection action").

---

## R-003 — Product photo sets: additive design

**Decision**: Add `menu_item_images` as an **additional** ordered photo set. `menu_items.image_path` remains the authoritative primary image and stays in every existing query.

**Rationale**: `menu_items.image_path` is consumed in eight places, all of which must keep working untouched:

| Site | Use |
|---|---|
| `menu.service.js:14` | `listOwned` select |
| `menu.service.js:33` | `getOwned` select |
| `menu.service.js:86,89` | `create` insert + returning |
| `menu.service.js:119` | field map `imagePath → image_path` |
| `menu.service.js:137` | `updateOwned` returning |
| `restaurants.service.js:195` | public menu select |
| `admin.controller.js:302` | `type=items` upload replaces the old file |
| `client/js/restaurant.js` `dishCard` / `renderSheet` | reads `item.image_path` |

Rewriting this column into a table would touch every one of them and risk regressing menu, ordering and image-deletion behaviour. The additive design touches **none** of them: the new table holds only photos at position ≥ 1, and the public payload exposes a merged array whose element 0 is `image_path`.

**Alternatives considered**: (a) Convert `image_path` into a full photo table — rejected, high regression risk across ordering and image cleanup for no user-visible gain. (b) Reuse `business_hero_images` polymorphically — rejected; conflates two owners and lifecycles behind one table, which is harder to reason about than one small dedicated table. Recorded as the single Complexity Tracking entry.

**Pattern to copy**: `business_hero_images` (migration 031 + `restaurants.service.js` hero functions + `files.service.js` `PUBLIC_PATH_RE` + `upload.js` `SUBDIRS`). The `items` subdir already exists in both `SUBDIRS` (`upload.js:24`) and `PUBLIC_PATH_RE` (`files.service.js:12`), so the upload and storage path need no new namespace — only the per-item set management is new.

**Performance**: photos load in the single existing public menu query via one `LEFT JOIN` ordered by position, not per-item requests (Principle XXIV, no N+1).

---

## R-004 — Category iconography

**Decision**: Replace the emoji lookup with a hand-authored inline SVG set drawn in the brand colour on a brand-tinted circle.

**Rationale**: The current implementation is a flat literal at `restaurant.js:265-279` — `CAT_EMOJI`, **17 keyword patterns** plus a `🍽️` fallback in `catEmoji` (`restaurant.js:275-282`). Because it is already a keyword→glyph table, replacing emoji with SVG is a **substitution in place**, not a new subsystem: same 17 regexes, same order, same fallback, glyph changes from an emoji code point to an inline `<svg>`.

The benchmark's own fallback treatment is a tinted circle with a vector glyph (`fill: var(--main)`), not an emoji — so this matches the reference rather than approximating it. Hand-authored SVG also needs no `imgSrc` CSP change (CSP `imgSrc` is `self data blob`; inline `<svg>` is not an image request) and no new dependency.

**Inventory required — 20 glyphs**: the 17 detected categories (burger, pizza/fries-sides, drinks, coffee, tea, dessert, ice cream, chicken, shawarma/wrap, salad, breakfast, fish, soup, bread, pasta, meat/grill) plus the generic fallback, plus the two synthetic rail entries `all` (🍽️, `restaurant.js:312`) and `popular` (⭐, `restaurant.js:313`).

**Why category photographs are deferred**: no seeded business stores any image — `database/seeds/seed-demo.js` inserts nothing into `uploaded_files`, `business_hero_images`, `restaurant_settings.logo_path/cover_path`, or `menu_items.image_path`. A photo-filled circle would render empty in every demo. The icon set meets FR-015 now; photographs become the upgrade path once businesses actually upload.

---

## R-005 — Product sheet height: brief vs. reference

**Decision**: 65–75% viewport, per the brief. Not the reference's full-screen sheet.

**Rationale**: The benchmark's product popup is `height: 100vh` with `border-radius: 0` — a full-screen takeover. The brief explicitly states "approximately 65–75% viewport height" and "It should NOT immediately become full-screen… This gives context." These conflict.

The brief wins: it is the explicit, repeated instruction, and the stated rationale (keep the menu visible for context) is a deliberate UX decision. The current implementation is already a true bottom sheet capped at `max-height: 82dvh` (`restivo.css:299-300, 406-429`), so this is a tuning change within existing behaviour, not a redesign. Recorded per Constitution XXVII.

---

## R-006 — Shared CSS class hazard between storefront and homepage demo

**Decision**: Namespace storefront component classes before restyling.

**Rationale**: The homepage's live demo (`restivo-landing.js:222-251`) reuses storefront class names — the `dish`, `qty`, `cart-*`, `live-hero`, `add-btn` family — and much of `restivo.css`'s `.live-*` styling targets them. A storefront restyle can therefore silently break the homepage demo and vice versa. Since both are being redesigned in this feature, the collision must be broken first, or every later visual change is unverifiable in isolation.

---

## Technology Best Practices Applied

| Area | Practice | Source |
|---|---|---|
| CSS custom properties | Single `:root` block, no preprocessor, no build step | Project constraint; `styleSrc` already permits `'unsafe-inline'` so runtime overrides remain possible |
| Responsive images | Reserve space with explicit aspect ratio before load to hold CLS ≤2px | SC-006 |
| Lazy loading | `loading="lazy"` below the fold only; first screenful never lazy | Existing precedent `restaurant.js:320` already sets `fetchpriority="high"` on slide 0 |
| Reduced motion | Existing convention honoured — carousel autoplay off, sheet teardown 0ms, marquee becomes a static wrap | `restaurant.js:381,492`; `restivo.css:88,347` |
| Focus management | Existing focus trap + focus restore retained; dialog semantics preserved | `restaurant.js:586-598`; required by `test-storefront-ux.js` |
| Upload validation | Sniff content bytes, ignore declared MIME and filename, derive extension from bytes | Existing `upload.js:26-40,69-70`; correct as-is |
| Migrations | Idempotent, one transaction per file, `schema_migrations` ledger, rollback on failure | `database/migrate.js:17-53`; Constitution VII |

## Outstanding Risks

| Risk | Mitigation |
|---|---|
| Restyle breaks the homepage live demo through shared classes | R-006: namespace first |
| Breaking a source-asserting test | `plan.md` carries an explicit preserve-list of every verified string contract |
| Correcting `test-hero-images.js` looks like weakening a test | FR-081 requires correcting the expectation *with* the behaviour; the corrected regex keeps its traversal and foreign-namespace assertions |
| Token consolidation regresses storefront rendering | `restivo.css` loads on only 2 pages, so it is the smallest blast radius; verify those 2 first |