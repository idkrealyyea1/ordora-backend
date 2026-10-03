# Quickstart — Validation Guide

How to run, and how to prove the feature works. Runnable validation only; implementation detail belongs in `tasks.md`.

---

## Prerequisites

| Requirement | Note |
|---|---|
| Node.js 20+ | `node -v` |
| PostgreSQL reachable | App uses `DATABASE_URL` or Wasmer `DB_*` |
| **Disposable** test database | `TEST_DATABASE_URL` — `tests/helpers.js:14-17` throws without it. **Never point this at production.** |

```bash
node -v                      # expect v20+
psql "$TEST_DATABASE_URL" -c 'select 1'
```

---

## Commands

```bash
npm run migrate      # node database/migrate.js        — applies database/migrations/*.sql
npm run check        # node scripts/check-syntax.js    — parses every .js; MUST be 0 failures
npm test             # node --test tests/              — 62 suites; needs TEST_DATABASE_URL
npm run seed:demo    # node database/seeds/seed-demo.js— creates slug "burger-house"
npm start            # node server.js
```

Seed env: `seed:demo` requires `SEED_DEMO_PASSWORD` (min 10 chars). `seed:admin` reads platform-owner credentials from env.

**Seed limitation to know up front**: `seed:demo` creates exactly **one** business with 3 categories, 8 items and **no images at all** — no logo, no cover, no item photos, no hero images. Visual verification of the cover, the identity card, the photo carousel and the homepage logo strip therefore requires uploading images by hand, or adding a local dev seed. See "Known gaps in verification" below.

---

## Validation scenarios

### V-1 — Migrate cleanly, twice

```bash
npm run migrate
npm run migrate     # every file must report "skip (already applied)"
```

**Expected**: first run applies `035_menu_item_images.sql`; second run skips everything. No error, no duplicate object.

**Proves**: Constitution VII — idempotent migration, backward compatible, existing businesses untouched.

---

### V-2 — Full test suite green

```bash
npm test
```

**Expected**: 62 suites pass. Zero failures. No test skipped or weakened.

**Specifically confirm these still pass** — they assert client source strings and are the rebuild's tripwires:

| Test | Asserts |
|---|---|
| `test-storefront-ux.js` | grid breakpoint value in `restivo.css`; `product-sheet`, `aria-modal`, `Escape` handler, `data-open=` present; `data-addopts` absent |
| `test-hero-images.js` | `hero-carousel` and `heroImages` present; `business_hero_images` + cap message in the service |
| `test-localization.js` | `storefrontLanguage` in storefront; `localStorage.setItem('restivo-lang'` in api.js |
| `test-seo.js` | `/api/seo/business/` and `document.documentElement.dir` in storefront |
| `test-dashboard-nav.js` | drawer selectors in `style.css` + `admin.html` |
| `hero-upload.test.js` | 5 hero-upload regressions incl. two consecutive uploads |
| `free-delivery.test.js` | 9 free-delivery regressions |

**Proves**: FR-078, FR-081.

---

### V-3 — Hero defect 1: add-after-remove (the reported bug's real cousin)

Automated (preferred):

```bash
node --test tests/hero-upload.test.js
```

Manual:

1. Sign in as the demo business's admin → dashboard → settings → cover photos
2. Upload image A. Confirm it appears.
3. Remove image A. Confirm it disappears.
4. **Upload image B immediately.**
5. Open `/restaurant/burger-house`.

**Expected at step 4**: upload succeeds. No error toast, no 500.

**Currently fails** — `restaurants.service.js:467` computes `MAX(position)` over active rows only while `031_business_hero_images.sql:16` holds `UNIQUE (business_id, position)`, so a soft-deleted position is reused and raises `23505`.

---

### V-4 — Hero defect 2: add-by-path accepts a real hero path

```bash
curl -sS -X POST http://localhost:3000/api/admin/hero-images \
  -H 'Content-Type: application/json' \
  -b "$COOKIE" \
  -d '{"imagePath":"/uploads/hero/550e8400-e29b-41d4-a716-446655440000.webp"}'
```

**Expected**: `201` with a hero image. **Currently** returns `400 "imagePath is invalid"` because `validators/index.js:783-788` only matches `covers`.

Then confirm rejection still works (FR-052, Principle X):

```bash
# foreign namespace → 400
-d '{"imagePath":"/uploads/logos/550e8400-e29b-41d4-a716-446655440000.webp"}'
# traversal → 400
-d '{"imagePath":"/uploads/hero/../secret.jpg"}'
# wrong extension → 400
-d '{"imagePath":"/uploads/hero/550e8400-e29b-41d4-a716-446655440000.svg"}'
```

---

### V-5 — Hero defect 3: owner console rejects an unvalidated path

```bash
curl -sS -X POST http://localhost:3000/api/restaurants/$RESTAURANT_ID/hero-images \
  -H 'Content-Type: application/json' \
  -b "$OWNER_COOKIE" \
  -d '{"imagePath":"not-a-real-path"}'
```

**Expected**: `400`. **Currently** succeeds and writes an unvalidated string into `business_hero_images.image_path` — `owner.routes.js:65` attaches no upload middleware, so `owner.controller.js:613-616` always falls through to the raw body value.

**Proves**: FR-054, Principle X. This is a security fix.

---

### V-6 — Hero defect 4: one selection uploads

Manual, on a 375px phone or a narrow desktop viewport:

1. Dashboard → settings → cover photos
2. Tap the add-cover area **once** and pick a file
3. **Expected**: upload starts immediately. No second tap on `+` required.

**Currently** nothing happens — `admin.js:1321-1323` opens the picker but no `change` listener exists on `#hero-file`.

Then remove one photo while others remain, and reload the storefront.

**Expected**: a primary cover is still shown (Invariant 2 in `data-model.md`).

---

### V-7 — Product photo set, backward compatibility

```bash
curl -sS http://localhost:3000/api/restaurants/burger-house/menu | jq '.items[0] | {image_path, images}'
```

**Expected for a business that never used the feature**: `image_path` present and unchanged; `images` is `[]` or equals `[image_path]`. **Proves** FR-030's backward-compatibility guarantee.

Then, via the dashboard, add a second photo to one item and re-fetch.

**Expected**: `images` has 2 entries, element 0 still `image_path`, element 1 the new photo, in position order.

---

### V-8 — Full customer journey (FR/SC-007)

On a running instance with a business that has images, at each of **320, 375, 390, 430, 768, 1024, 1280, 1440, 1920** px, in **both** Arabic and English:

```text
open /restaurant/:slug → cover rotates → identity card overlaps cover
→ toggle delivery/pickup → switch language → scroll the circular rail
→ tap a product → sheet rises to 65–75% and the menu stays visible above
→ swipe product photos → pick a required size → add extras → set quantity
→ read the live total → add to order → open cart → check out
→ receive an order code → open /track?code=… and follow it
```

**Expected at every width and both directions**

- No horizontal page scroll (FR-002)
- No console errors (FR-077)
- No broken images (FR-077)
- Cover + identity occupy ≥40% of the initial mobile viewport (SC-003)
- Item photo occupies ≥1/3 of the item's visible surface (SC-004)
- Sheet settles between 65% and 75% viewport height (SC-005)
- Language switch also switches direction, including inside the open sheet
- Order total equals the server-confirmed total (FR-032)

Capture a screenshot at each width. This is the "actually inspect it" gate — passing tests is not sufficient (FR-082).

---

### V-9 — Free delivery is server-authoritative (FR-038, SC-011)

```bash
# enable with a threshold, then submit an order with a forged free-delivery claim
curl -sS -X POST http://localhost:3000/api/restaurants/burger-house/orders \
  -H 'Content-Type: application/json' -b "$COOKIE" \
  -d '{"items":[...],"orderType":"delivery","subtotalCents":99999999,
       "deliveryFeeCents":0,"freeDelivery":true}'
```

**Expected**: the persisted fee is the server's own computation. The forged fields are ignored. Cross-check against `tests/free-delivery.test.js`, which already covers below/at/above threshold, pickup exemption, disabling, invalid config, public exposure, and tenant isolation.

---

### V-10 — Accessibility and reduced motion (FR-071 to FR-074, SC-015, SC-016)

- Tab through the whole storefront: category rail, every item, the sheet, the cart. Every stop has a visible focus indicator.
- Open the sheet: focus is trapped, Escape closes it, focus returns to the originating item.
- DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: carousel autoplay stops, sheet transition is instant, the homepage logo strip does not animate.
- DevTools → Rendering → emulate `vision deficiency`: check all text; switch the business brand colour and re-check contrast.
- Automated audit on `/restaurant/:slug`, `/`, `/admin.html`: no serious violations.

---

### V-11 — Performance (FR-076, SC-006, SC-014)

- DevTools → Network → Slow 4G + CPU 4× throttle, cache disabled, load `/restaurant/:slug`
- Largest Contentful Paint ≤2.5s
- Record total transferred bytes **before and after** — must not increase
- Confirm no layout shift while images load: Performance panel, Cumulative Layout Shift ≤ small
- Confirm zero new entries in the network waterfall's JS column versus the pre-redesign baseline (FR-075)

---

### V-12 — Token consolidation proof (FR-066, FR-067, SC-013)

```bash
grep -rn "client/css/storefront.css" client/     # expect: no references (deleted + unlinked from sw.js)
grep -rnoE "#[0-9a-fA-F]{3,8}\b" client/css/tokens.css | wc -l   # expect: all raw hex lives here
```

Then, in the browser on `/`, `/restaurant/:slug`, `/admin.html`, `/pricing.html`:

1. Open DevTools → `<html>` element → edit one token value (e.g. the coral accent)
2. **Expected**: the change appears on all four surfaces immediately, with no file edit

**Proves**: SC-013 and FR-066.

---

## Known gaps in verification

Honest limitations, so nothing here reads as verified when it is not.

| Gap | Consequence | Mitigation |
|---|---|---|
| `seed:demo` creates one business and **zero images** | The cover, identity card, product photo carousel and homepage logo strip cannot be visually verified from seed data alone | Upload images manually via the dashboard, or add a local-only dev seed. Do **not** ship fabricated demo content — FR-064 forbids it |
| Homepage logo strip has at most one real business | Validates the graceful-degradation path, not the full marquee | Verify both: the populated case (after uploading a logo) and the empty case |
| `npm test` needs a real disposable PostgreSQL | Cannot run without `TEST_DATABASE_URL` | Provision a disposable database; never production |
| `npm run check` is parse-only | A passing check says nothing about behaviour | V-8 and V-10 are the behavioural gate |
| No automated visual regression baseline | A silent visual regression could pass CI | Screenshot capture at all 9 widths during V-8 and store as the baseline |

## Definition of done

- [ ] V-1 migrations idempotent
- [ ] V-2 all 62 suites green, none weakened
- [ ] V-3 add-after-remove succeeds (20 consecutive automated repetitions, SC-009)
- [ ] V-4 real hero path accepted, foreign and traversal paths still rejected
- [ ] V-5 owner console rejects an unvalidated path
- [ ] V-6 one selection uploads; a primary cover always remains
- [ ] V-7 existing items unaffected; photo set ordered correctly
- [ ] V-8 journey passes at 9 widths × 2 directions, no console errors, no broken images
- [ ] V-9 free delivery server-authoritative under forgery
- [ ] V-10 keyboard, reduced motion, contrast all pass
- [ ] V-11 LCP ≤2.5s, weight not increased
- [ ] V-12 one token drives every surface; no stray hex outside the token source
- [ ] `npm run check` — 0 failures
- [ ] Final report written with anything unverified marked **NOT VERIFIED**
- [ ] No deploy without explicit approval (Constitution XXVI)