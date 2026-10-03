# Feature Specification: Storefront Visual Rebuild & MenuX-Grade Design Quality

**Feature Branch**: `017-storefront-visual-rebuild`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "COMPLETE STOREFRONT VISUAL/UX REDESIGN benchmarked against https://menux.app/. Stop making cosmetic changes. Rebuild the storefront presentation (cover/carousel, overlapping restaurant identity, circular section navigation, full-width dense menu, premium product bottom sheet, delivery/pickup + search + language + cart controls). Add multi-image hero management with the 'Unsupported image type' second-upload bug fixed at root cause, a free-delivery threshold enforced by the backend, a desktop sidebar + mobile drawer dashboard with a professional image manager, and a restructured marketing homepage (strong hero, real-business logo slider, remove 'Our Family', honest pricing from real plan data). Maintain one design-token system across homepage/storefront/sheet/cart/checkout/dashboard. Mobile-first, RTL-correct, accessible, fast, no fabricated data, no regression to existing features."

---

## Current State Baseline (verified against code, not documentation)

This feature is a **rebuild of presentation**, not a greenfield build. The following already exist, are working, and are covered by tests. This spec MUST NOT re-specify or regress them — it MUST raise their visual quality and close the specific gaps listed in `## Requirements`.

Already implemented and working:

| Area | State |
|---|---|
| Hero cover carousel | Multiple images, autoplay, swipe, dots, reduced-motion aware |
| Restaurant identity | Overlapping logo card already pulls up over the cover |
| Section navigation | Circular category rail with emoji icons already exists |
| Menu item cards | Borderless grid, no "ADD" button on the storefront (card is the hit target) |
| Product detail | Real bottom sheet with drag-to-dismiss, focus trap, ESC close, option groups |
| Delivery / pickup | Segmented control, persisted per business |
| Search | Toggle + inline filter |
| Language | ar/en with visitor persistence + business default |
| Free delivery | Business toggle + threshold, server-authoritative, publicly exposed, 9 tests |
| Hero image dashboard | Add / preview / set-primary / remove, hidden file input |
| "Unsupported image type" | Server-side root cause fixed; 5-test regression suite incl. two consecutive uploads |
| Homepage real-business strip | Marquee driven by the live business directory, no invented names |
| Dashboard navigation | Sidebar ≥900px, burger drawer below |
| Option groups | Sizes (`replace`) and add-ons (`adjust`), validated server-side |

Genuine gaps this feature closes:

1. Visual quality/density/composition still reads generic — the complaint that motivates this feature.
2. **Four live defects** adjacent to hero images (delete-then-upload failure, an add-by-path route that rejects every real hero path, an unvalidated owner-console insert, a dashboard file picker that does not fire on selection).
3. Hero image **reordering** — the API accepts it; no UI exists.
4. **No product image carousel** — one image per product; the "images" capability is declared but unimplemented.
5. Category circles use **emoji**, which the brief explicitly calls out as cheap.
6. **Three competing token files**, one of them entirely dead, so surfaces do not share a design language.
7. Homepage lacks a product demonstration section and a customer-journey narrative.

---

## Clarifications

### Session 2026-10-03

- **Q1 — Data foundations**: Does this rebuild include new persisted data? → **A: Product photo sets only.** One migration, one new ordered image set per menu item, first image remains the existing primary. Nutrition/ingredient/allergen fields are NOT added; those render only when already present. Uploaded category photos are deferred — no business currently stores any image, so photo-in-circle would render empty (see FR-015).
- **Q2 — Category iconography**: What replaces emoji in the circular rail? → **A: Curated inline SVG icon set**, drawn in the brand colour on a brand-tinted circle, replacing the existing emoji lookup in place. This matches the reference's own fallback treatment (tinted circle + vector glyph) and needs no schema. Uploaded category photos are the named upgrade path, taken once businesses actually store images.
- **Q3 — Design-token consolidation**: One token source, or harmonised separate files? → **A: One shared token source** loaded by every surface (homepage, storefront, sheet, cart, checkout, dashboard). The reference achieves its entire look from two variables; three competing sources are precisely why the current surfaces drift apart. The five source-asserting test suites are updated as part of this work, never weakened.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the menu on a phone (Priority: P1)

A customer opens a restaurant link on a phone, on a slow connection, in Arabic. Within two seconds they know which business this is, see large appetising food, understand what sections exist, and use almost the whole screen width. No narrow centered column, no dead gutters, no thumbnail-sized food.

**Why this priority**: The storefront is the product's primary customer interface and the sole reason the brief exists. Everything else is secondary.

**Independent Test**: Open any seeded restaurant at 320, 375, 390 and 430px wide with no browser devtools, and judge composition and density. Delivers the core "premium digital menu" value alone.

**Acceptance Scenarios**:

1. **Given** a restaurant with 3 hero images, 6 categories and 40 products, **When** a customer opens it on a 375px phone, **Then** the cover fills the top of the viewport, the restaurant identity card visibly overlaps it, and the circular category rail sits below with no horizontal scrolling of the page itself.
2. **Given** any viewport width from 320px to 1920px, **When** a product name or price is longer than its container, **Then** the text truncates or wraps inside its card and never causes horizontal page scrolling or clipped content.
3. **Given** a product with a photo, **When** it is displayed in the menu, **Then** the photo occupies a majority proportion of the item's surface, is not stretched, and has a deliberate crop.
4. **Given** a category name longer than its label, **When** the circular rail renders, **Then** the label truncates with an ellipsis and every circle remains uniformly sized and evenly spaced.

---

### User Story 2 - Configure a product in a premium bottom sheet (Priority: P1)

A customer taps a product. Instead of losing their place, a sheet rises from the bottom covering roughly two-thirds of the screen, leaving the menu visible above for context. Inside, in one continuous scroll: the food image, the name, the price, the description, sizes, extras, any real detail fields, a quantity control, and one strong "add to order" action showing the live total. The customer adds the item to the existing cart without ever leaving the menu.

**Why this priority**: This is the conversion moment. A weaker detail view directly reduces orders.

**Independent Test**: Tap any seeded product with option groups, pick a size and two extras, change quantity, add to cart, verify the cart badge and total update. Deliverable with no other story.

**Acceptance Scenarios**:

1. **Given** a customer on the menu, **When** they tap a product, **Then** a sheet slides up from the bottom, the menu remains partially visible above it, and the sheet does not open full-screen by default.
2. **Given** a product with a required size group, **When** the sheet is open and the customer tries to add without choosing, **Then** the action is blocked with a clear inline message on that group.
3. **Given** a product with real detail fields such as calories or ingredients, **When** the sheet is open, **Then** those fields appear; **when** the product has none, **Then** no empty section, placeholder, or invented value is rendered.
4. **Given** a product with multiple photos, **When** the sheet is open, **Then** the customer can swipe horizontally through all photos with a clear current-position indicator.
5. **Given** any quantity and option selection, **When** the customer activates "add to order", **Then** exactly one add-to-cart action occurs, no duplicate item appears, and the price the customer paid is the price the server confirms.

---

### User Story 3 - Change ordering mode, language, and search (Priority: P2)

A customer who wants delivery instead of pickup, or who prefers English, or who wants to find the one dish they came for, can do each of these from the storefront in one or two interactions, and their choice persists.

**Why this priority**: Common, cheap wins that make the menu feel finished. Less critical than the browse and configure moments.

**Independent Test**: Toggle delivery→pickup, switch Arabic→English, search for a known dish name, reload the page. Verifiable without any other story.

**Acceptance Scenarios**:

1. **Given** a business that offers both modes, **When** the customer selects pickup, **Then** the choice is immediately obvious, the delivery fee messaging updates, and the choice survives a page reload.
2. **Given** the storefront in Arabic, **When** the customer selects English, **Then** the whole interface including the sheet and cart switches direction and language, and the choice survives a reload.
3. **Given** a customer searches for a term matching nothing, **When** results are empty, **Then** a designed empty state with a clear way back is shown — never a blank area or raw error text.
4. **Given** a business that has delivery disabled, **When** its storefront loads, **Then** the delivery control is absent rather than shown-and-rejected.

---

### User Story 4 - A business owner manages cover photos from a phone (Priority: P2)

A restaurant owner on a phone opens the dashboard, sees a polished cover-photo manager, adds photos by tapping once and picking from their phone, reorders them by dragging, removes one, and immediately sees the storefront cover change. Nothing errors, nothing is a raw file input.

**Why this priority**: The cover is the storefront's first impression; owners must be able to maintain it themselves or the redesign decays immediately.

**Independent Test**: On a 375px phone with the owner dashboard, add a third cover photo, drag it to first position, delete another, then open the storefront and confirm the order and the cover. Fully testable alone.

**Acceptance Scenarios**:

1. **Given** a business with two cover photos, **When** the owner picks a third image, **Then** it uploads, appears in the manager, and appears on the storefront — with no error and no second tap required.
2. **Given** a business whose cover photos are being reordered, **When** the owner removes one photo and then adds a new one, **Then** the add succeeds and no failure is surfaced to the owner.
3. **Given** a business at its cover-photo limit, **When** the owner tries to add another, **Then** they are told the limit in plain language before uploading, not after.
4. **Given** an image format the platform does not accept, **When** the owner selects it, **Then** they are told which formats are accepted, and no invalid file is ever stored.
5. **Given** an owner reordering photos on a phone, **When** they reorder, **Then** the new order is reflected on the storefront immediately, with a keyboard-accessible alternative to dragging.

---

### User Story 5 - A business owner sets a free-delivery promise (Priority: P2)

An owner enables free delivery above a threshold and enters an amount. Customers see an honest progress indicator while shopping and a clear "free delivery" state once they qualify, and the fee is zeroed by the server — never by the browser.

**Why this priority**: A conversion lever with a real revenue dimension; correctness matters more than looks here.

**Independent Test**: Enable the threshold, add items below it, cross it, and confirm the customer's charged fee in the confirmed order matches the server's decision. Testable alone.

**Acceptance Scenarios**:

1. **Given** free delivery is enabled at a threshold, **When** a customer's delivery order subtotal reaches the threshold exactly, **Then** no delivery fee is charged.
2. **Given** free delivery is enabled, **When** a customer's delivery subtotal is below the threshold, **Then** the normal fee is charged and the storefront shows how much more is needed for free delivery.
3. **Given** a pickup order, **When** it is submitted, **Then** no delivery fee is charged regardless of any threshold.
4. **Given** a browser that reports a fabricated total or a fabricated "free delivery" state, **When** the order is submitted, **Then** the server's own recomputed fee and total are the ones persisted and confirmed.

---

### User Story 6 - A prospective owner evaluates Restivo on the homepage (Priority: P3)

A restaurant owner lands on the homepage, understands within seconds what Restivo is and who it is for, sees real businesses already using it, sees what the product actually looks like, understands pricing from real plan data, and gets a clear call to action.

**Why this priority**: Needed for growth, but the storefront — where revenue already happens — is P1.

**Independent Test**: Load `/` and answer "what is this, who is it for, what does it cost, what do I do next" without scrolling past the pricing and call to action.

**Acceptance Scenarios**:

1. **Given** any visitor, **When** the homepage loads, **Then** the headline states what Restivo is, one primary and one secondary action are visible without scrolling, and the page does not open with a feature list.
2. **Given** fewer real businesses with logos than the logo strip needs, **When** it renders, **Then** it shows exactly what exists and degrades gracefully — it never displays a placeholder business, invented name, or fabricated statistic.
3. **Given** a visitor who has requested reduced motion, **When** the logo strip renders, **Then** the animation does not run and the content is still fully readable.
4. **Given** a platform owner who has changed the subscription price, **When** the homepage renders, **Then** the displayed price reflects that real value and no invented price or invented capability appears anywhere.
5. **Given** any public page, **When** a visitor inspects it, **Then** the same logos, type scale, colour usage, buttons and spacing read as one product across homepage, storefront, sheet, cart, checkout and dashboard.

---

### User Story 7 - An owner works in the dashboard on desktop and phone (Priority: P3)

An owner on a laptop sees a persistent sidebar; the same owner on a phone opens a slide-out drawer. Both contain exactly the sections their plan and business type allow, in the same order, with the same meaning.

**Why this priority**: The owner's daily workspace. Correct and usable beats redesigned.

**Independent Test**: Load the dashboard at 1440px and at 375px and confirm the same sections are reachable, with a visible sidebar on desktop and a drawer on mobile.

**Acceptance Scenarios**:

1. **Given** a desktop viewport ≥1024px, **When** the dashboard loads, **Then** a persistent sidebar is visible and no hamburger-only navigation is required.
2. **Given** a mobile viewport, **When** the owner opens navigation, **Then** a drawer slides in from the edge, traps focus, closes on Escape and on outside tap, and shows the same sections as the desktop sidebar.
3. **Given** a plan or business type that excludes a section, **When** the owner views navigation on any device, **Then** that section is absent, and the hiding is enforced by the server rather than only visually concealed.

---

### User Story 8 - The next engineer keeps surfaces coherent (Priority: P3)

A developer adding a component to the storefront needs one authoritative place for colour, spacing, type, radius, elevation, motion and layering, so that the storefront, homepage, sheet, cart, checkout and dashboard cannot drift apart.

**Why this priority**: Not customer-visible directly, but it is the mechanism that keeps this redesign from regressing to the generic look that caused it.

**Independent Test**: Change one token and observe the same change across all surfaces; search the client for hardcoded colour values outside the token source and find none.

**Acceptance Scenarios**:

1. **Given** a token change, **When** any surface is loaded, **Then** the change appears on all of them without editing a second file.
2. **Given** any client-side style, **When** reviewed, **Then** colour, spacing, radius, elevation, transition and layer values come from the token source rather than literals.
3. **Given** a brand colour configured by a business, **When** its storefront renders, **Then** brand tints and active states derive from that configured colour consistently.

---

### Edge Cases

- A business with **zero** cover photos, one cover photo, or more than the platform limit.
- A product with **no** photo (placeholder treatment must not look broken), **no** description, **no** options, or a very long option name.
- A product whose options are required but every choice is sold out.
- A menu with **one** category, or **fifty** categories (rail must stay scrollable and legible).
- Category names that are identical, very long, or differ only by direction of text.
- A business name long enough to collide with its open/closed badge at 320px.
- Removing the cover photo that is currently shown first, while others remain.
- Adding a cover photo immediately after removing one (the position-collision case).
- Free-delivery threshold set to 0, set to the exact subtotal, or above every achievable subtotal.
- Rapidly tapping a product, or tapping add-to-order twice fast.
- Switching language while the product sheet is open.
- A screen reader user traversing the category rail, the sheet, and the cart.
- A visitor with reduced motion, on a 320px screen, on a very slow connection.
- Zero real businesses with logos — the honest empty state for the homepage strip.

## Requirements *(mandatory)*

### Visual Composition & Density

- **FR-001**: The storefront menu MUST use the full available width at every breakpoint, with a single consistent edge gutter of at most 16px per side, and MUST NOT present a narrow centered column on any viewport from 320px to 1920px.
- **FR-002**: The storefront MUST cause no horizontal page scrolling at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px, with text truncating or wrapping inside its container rather than overflowing.
- **FR-003**: The storefront MUST use a two-column menu composition at desktop widths where content permits, with no large empty region beside or between items.
- **FR-004**: Vertical spacing between menu items, between category sections, and between a section heading and its first item MUST follow one consistent rhythm across the whole storefront, not ad-hoc values.
- **FR-005**: Menu items MUST be visually separated by whitespace and subtle surface contrast rather than by heavy borders, cards-within-cards, or large radii on every element.

### Cover & Restaurant Identity

- **FR-006**: The cover MUST occupy a substantial proportion of the initial mobile viewport height so that food imagery leads the page, and MUST crop images to a deliberate aspect ratio rather than stretching them.
- **FR-007**: When a business has more than one cover photo, the cover MUST rotate automatically, support swipe, offer desktop controls, and MUST NOT shift surrounding layout while rotating.
- **FR-008**: The cover's position indicator MUST be visually designed and MUST be absent entirely when only one cover photo exists.
- **FR-009**: The restaurant identity MUST sit in its own visually separated surface that overlaps the lower edge of the cover by a deliberate amount, presenting the logo, name, description and open/closed status as one anchor unit rather than an image floating on a photo.
- **FR-010**: The identity block MUST remain legible at 320px and MUST NOT let a long business name collide with or displace its status badge.
- **FR-011**: Where a business has no logo, the identity block MUST present a deliberate monogram treatment rather than a broken image.

### Section (Category) Navigation

- **FR-012**: Section navigation MUST present categories as uniformly sized circular visual elements with visible labels, arranged in a horizontally scrollable rail on mobile.
- **FR-013**: The active section MUST be obvious at a glance and MUST NOT shift surrounding elements when it changes.
- **FR-014**: Every section control MUST be reachable and operable by touch and by keyboard, with a touch target of at least 44px.
- **FR-015**: Section iconography MUST use a curated inline vector icon set drawn in the brand colour on a brand-tinted circle. Emoji and unstyled emoji buttons MUST NOT be used. Icons MUST be selected by the existing category-name keyword match so that no category renders without an icon, falling back to a neutral generic icon. Uploaded category photographs are a permitted future enhancement and are explicitly deferred by this feature.
- **FR-016**: A business with a very large number of sections MUST keep the rail usable and legible without the labels colliding or the rail becoming unscrollable.

### Item Presentation & Imagery

- **FR-017**: Each menu item MUST communicate image, name, description, price, and unavailability where applicable, using a typographic hierarchy that makes the name and price legible at a glance.
- **FR-018**: Food imagery MUST occupy a majority proportion of the item's visible surface, MUST use a non-distorting crop, and MUST NOT be rendered as a small thumbnail.
- **FR-019**: Item imagery MUST reserve its space before loading so that no layout shift occurs as images arrive.
- **FR-020**: Items below the fold MUST load lazily; the first screenful of food imagery MUST NOT.
- **FR-021**: Menu items MUST NOT carry a prominent "add" affordance; the item itself MUST be the interaction that opens its details.
- **FR-022**: Popularity, newness, featured and sold-out states MUST be communicated by restrained badges, and a sold-out item MUST be visibly unavailable without looking broken.
- **FR-023**: Items with no photo MUST present a deliberate placeholder that preserves the item's proportions.

### Product Detail Sheet

- **FR-024**: Activating a menu item MUST open an overlay sheet from the bottom edge within the same view, MUST NOT navigate to a separate page, and MUST settle at roughly 65–75% of the viewport height so the menu remains visible above it.
- **FR-025**: The sheet MUST animate smoothly and quickly, and MUST be dismissible by an explicit close control, by Escape, and by dragging it downward.
- **FR-026**: The sheet MUST present, in one continuous scroll, in this order: the product image, name, price, description, option groups, real detail fields, quantity, and the add-to-order action.
- **FR-027**: The add-to-order action MUST remain reachable without scrolling away from the quantity control, and MUST display the total for the current quantity and option selection.
- **FR-028**: Option groups MUST clearly state their name, the selection rule (required with how many to choose, or optional), and the price effect of each choice.
- **FR-029**: The sheet MUST render only detail fields that exist for the product, and MUST NOT display empty sections, placeholder copy, or invented nutritional, ingredient or allergen information.
- **FR-030**: Every menu item MUST support an ordered set of photos. The first photo MUST remain the item's existing primary image so that no existing business loses its current photo or breaks at a known URL. Where an item has more than one photo, the sheet MUST provide a horizontal swipeable photo view with a visible current-position indicator; where it has exactly one, the sheet MUST show that photo with no photo chrome.
- **FR-031**: The sheet MUST trap keyboard focus while open, MUST be dismissible by Escape, and MUST return focus to the item that opened it.
- **FR-032**: Adding from the sheet MUST integrate with the existing single cart, MUST NOT create a second cart or pricing path, and the server MUST remain the sole authority on price.

### Ordering Controls

- **FR-033**: Delivery and pickup MUST be presented as one immediately understandable, elegantly styled control that reflects the current selection, and MUST be absent when the business does not offer that mode.
- **FR-034**: Search MUST appear as part of the menu experience rather than as an incidental form field, MUST match item names and descriptions, MUST support both languages, and MUST present a designed empty state.
- **FR-035**: The language selector MUST be compact, MUST show small tasteful language indicators, MUST switch the entire interface including the sheet and cart, and MUST persist across visits.
- **FR-036**: The cart MUST be presented in the same visual language as the rest of the storefront, and MUST NOT introduce a separate visual system.

### Free Delivery Presentation

- **FR-037**: Where free delivery is enabled above a threshold, the storefront MUST show the customer either the amount still needed to qualify or an unambiguous free-delivery state.
- **FR-038**: Free-delivery qualification MUST be decided by the server from the order's own subtotal, and MUST NOT be derivable from, or overridable by, any client-supplied total, fee, or free-delivery flag.
- **FR-039**: The dashboard MUST let a business owner enable free delivery and set a threshold, MUST validate the amount, and MUST disable the amount field while the feature is off.
- **FR-040**: Existing businesses with no free-delivery setting MUST continue charging the normal delivery fee with no configuration required.

### Dashboard Navigation & Cover Management

- **FR-041**: The dashboard MUST present a persistent sidebar at desktop widths of 1024px and above, and MUST NOT require a hamburger to reach any section on desktop.
- **FR-042**: Below 1024px the dashboard MUST present a slide-out drawer containing the same sections as the desktop sidebar, dismissible by Escape, an explicit close control, and an outside tap, with focus trapped while open.
- **FR-043**: Sections excluded by plan entitlement, capability, or business type MUST be omitted identically on desktop and mobile, and their omission MUST be enforced server-side on every request rather than hidden in the browser.
- **FR-044**: The dashboard MUST present a professional cover-photo manager supporting add, preview, remove, and reorder, with no raw file input exposed to the owner.
- **FR-045**: Adding a cover photo MUST require exactly one selection action and MUST upload without a further tap.
- **FR-046**: The cover-photo manager MUST communicate the platform's cover-photo limit before an upload is attempted, in plain language.
- **FR-047**: Reordering cover photos MUST be reflected on the storefront, and MUST be achievable without a pointer drag.
- **FR-048**: A failed or rejected image upload MUST leave the business's existing cover photos unchanged and MUST NOT store an unusable file.
- **FR-049a**: A business owner MUST be able to add, preview, reorder and remove photos for a single menu item through the same professional uploader used for cover photos, with the first photo designated primary and the public menu exposing the full ordered set.

### Image Upload Correctness

- **FR-049**: Adding a cover photo immediately after removing another cover photo MUST succeed; the current behaviour fails in this sequence and MUST be corrected at its cause rather than worked around.
- **FR-050**: Any route that registers a cover photo by path MUST accept every path the platform itself produces; the current route rejects all real cover-photo paths and MUST be corrected.
- **FR-051**: Every write of a cover-photo path MUST be validated identically regardless of which dashboard performed it.
- **FR-052**: Accepted image formats MUST be limited to a documented allow-list of JPEG, PNG and WebP, verified by inspecting the file's actual content rather than trusting its declared type or name, capped in size, and stored so that it is served back with a correct content type. AVIF MAY be added only if it can be validated as safely as the existing formats.
- **FR-053**: A file whose content does not match its declared type MUST be rejected, and the rejection message MUST name the accepted formats.
- **FR-054**: The owner console's cover-photo registration MUST go through the same upload handling and the same validation as the business dashboard, and MUST NOT accept an unvalidated path from the request body.
- **FR-055**: Regression tests MUST cover, at minimum: two consecutive cover uploads on one business; add-after-remove; acceptance of JPEG, PNG and WebP; rejection of a mis-declared and a spoofed file; and cross-tenant refusal.

### Homepage

- **FR-056**: The homepage MUST open with a single clear statement of what Restivo is, one primary and one secondary action, both visible without scrolling.
- **FR-057**: The homepage MUST NOT open with a feature list, and MUST NOT exceed roughly two screens before conveying the product's purpose.
- **FR-058**: Immediately below the hero, the homepage MUST present a horizontal moving strip of businesses that exist in the platform, using their real names and real logos, and MUST display nothing rather than invented entries when too few exist.
- **FR-059**: The logo strip MUST NOT animate for visitors who have requested reduced motion.
- **FR-060**: The homepage MUST include a section demonstrating what the actual product looks like, and a section describing the customer ordering journey end to end.
- **FR-061**: The homepage MUST cover the supported food-business types without claiming support it does not have.
- **FR-062**: Pricing MUST be rendered from the platform's real subscription data. No price, discount, plan capability, or limit may be stated that the platform does not actually enforce.
- **FR-063**: The existing restaurant showcase branded as a "family" MUST be removed, along with its unused styling, and replaced by the product demonstration section.
- **FR-064**: No public page may display an invented business, logo, testimonial, review, rating, customer count, or usage statistic.
- **FR-065**: The homepage MUST end with a clear call to action and a complete footer, in the same visual language as the rest of the site.

### Design System

- **FR-066**: Colour, spacing, type scale, radii, elevation, motion and layering MUST have a single authoritative token source consumed by the homepage, storefront, product sheet, cart, checkout and dashboard.
- **FR-067**: Client-side styling MUST NOT introduce literal colour, radius, shadow, or transition values outside the token source.
- **FR-068**: Styling that no longer renders MUST be removed rather than left in place.
- **FR-069**: Brand tints and active states MUST derive from the business's configured brand colour, so a tenant's brand reads consistently across the storefront.
- **FR-070**: Colour, spacing, type scale, radii, elevation, motion and layering MUST have a single authoritative token source consumed by the homepage, storefront, product sheet, cart, checkout and dashboard. Every surface loads that one source rather than declaring its own palette.

### Accessibility, Responsive Behaviour & Performance

- **FR-071**: All interactive elements MUST be operable by keyboard with a visible focus indicator, and the storefront MUST be fully usable in both right-to-left and left-to-right directions with no mirrored-layout defects.
- **FR-072**: Overlay surfaces MUST expose dialog semantics, trap focus, close on Escape, and return focus on close.
- **FR-073**: Text and meaningful non-text elements MUST meet accessible contrast in both the default and business-branded colour configurations.
- **FR-074**: Animated transitions MUST be suppressed or minimised for visitors who have requested reduced motion.
- **FR-075**: The redesign MUST NOT introduce a new client-side runtime dependency or a build step.
- **FR-076**: The storefront's first screenful of content MUST become usable within 2.5 seconds on a mid-range phone over a 4G-class connection, and the redesign MUST NOT regress current page weight or load time.
- **FR-077**: The storefront MUST be verified at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px, in both languages, with no broken images and no console errors.

### Honesty & Non-Regression

- **FR-078**: Every existing capability MUST continue working: onboarding, login, sessions, tenant isolation, menu and category management, products, options, images, cart, guest checkout, orders, order tracking and lifecycle, delivery, pickup, analytics, web push, live updates, subscriptions, capabilities, localization, and search engine visibility.
- **FR-079**: Server-side authority MUST be preserved for prices, delivery fees, free-delivery qualification, availability, opening hours, plan entitlements, and capabilities. No client-supplied value may influence any of them.
- **FR-080**: Tenant isolation, authentication, authorization, origin protection, session security and upload validation MUST NOT be weakened by this feature.
- **FR-081**: No existing test may be weakened, deleted, or relaxed to accommodate the redesign. Where an existing test encodes an incorrect expectation, it MUST be corrected together with the behaviour it was wrongly asserting.
- **FR-082**: Completion MUST NOT be claimed without visual inspection of the running storefront, homepage, product sheet and dashboard at the required viewport widths in both languages.

### Key Entities

- **Cover photo**: an ordered, removable image belonging to one business, of which one is designated primary; there is a platform-wide maximum number per business.
- **Product photo set**: an ordered set of images belonging to one menu item, where the first is the item's existing primary image. Adding the set MUST be backward compatible — an existing business with one image MUST behave exactly as it does today.
- **Business category / section**: an ordered grouping of menu items belonging to one business, with an optional visual identifier.
- **Option group**: a required or optional set of choices attached to one menu item, with a selection rule and a per-choice price effect.
- **Menu item**: a purchasable item belonging to one business and optionally one category, with a price, an availability flag, and optional popularity, featured and pre-order attributes.
- **Free-delivery policy**: an optional per-business flag plus an integer-cent threshold, defaulting to disabled.
- **Order**: a guest or customer purchase with a server-recomputed subtotal, delivery fee, and total, plus a frozen snapshot of item names, options and prices.
- **Business**: a tenant owning settings, cover photos, categories, menu items, option groups and its free-delivery policy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer can go from opening a restaurant to having an item in the cart in at most four interactions, without leaving the menu view.
- **SC-002**: The menu area occupies the viewport width minus a gutter of 16px or less per side, at all nine required viewport widths, with no horizontal page scrolling at any of them.
- **SC-003**: The cover and overlapping restaurant identity occupy at least 40% of the initial mobile viewport height at 375px.
- **SC-004**: On every menu item that has a photo, the photo occupies at least one third of the item's visible surface area.
- **SC-005**: The product sheet opens to between 65% and 75% of the viewport height, with the menu visibly remaining above it.
- **SC-006**: No content shift greater than 2px occurs on the storefront as images and fonts load.
- **SC-007**: The complete customer journey — open restaurant, view cover, view identity, switch mode, switch language, browse sections, open a product, view photos, choose options, set quantity, add to cart, open cart, check out, receive an order, view tracking — completes with zero console errors and zero broken images at all nine viewport widths in both languages.
- **SC-008**: A business owner can add a cover photo in at most two interactions from the dashboard on a phone, and can reorder and remove cover photos without a pointer drag.
- **SC-009**: Adding a cover photo immediately after removing one succeeds in 100% of attempts across 20 consecutive automated repetitions.
- **SC-010**: Every existing test continues to pass unmodified, and at least the tests named in FR-055 are added and pass.
- **SC-011**: Free-delivery qualification matches the server's decision in 100% of order submissions, including cases where the client submits a fabricated total, fee, or free-delivery flag.
- **SC-012**: Zero fabricated businesses, logos, testimonials, ratings, prices, or statistics appear on any public page; every displayed business in the homepage strip resolves to a real business record.
- **SC-013**: No hardcoded colour, radius, shadow or transition values remain in client styling outside the token source, verifiable by search.
- **SC-014**: The storefront's first screenful is usable within 2.5 seconds under a throttled mid-range mobile profile, and total transferred page weight does not increase relative to the pre-redesign storefront.
- **SC-015**: All body text meets a 4.5:1 contrast ratio and all meaningful non-text elements meet 3:1, in both the default and a business-branded colour configuration.
- **SC-016**: Every interactive element is reachable and operable by keyboard alone, with a visible focus indicator, and the storefront passes an automated accessibility audit with no serious violations.
- **SC-017**: No new client-side runtime dependency and no build step is introduced.

## Assumptions

- The reference site is used strictly as a benchmark for visual and interaction quality. No reference source code, assets, logos, text, or graphics will be copied. Category, product, and marketing content remains Restivo's own.
- The redesign is a presentation rebuild over the existing architecture. No framework migration, no build step, no new deployment infrastructure, and no change to authorization logic.
- Existing functionality listed in the Current State Baseline is retained and re-skinned, not rebuilt. Requirements above specify the visual and behavioural delta only.
- Free delivery remains a per-business opt-in with a safe default of disabled, enforced server-side, with prices in integer minor units.
- Nutrition, ingredient, and allergen fields are displayed only where they already exist. Adding new persisted product-detail fields is not assumed and is not in scope.
- Uploaded category photographs are deliberately out of scope for this feature. No business currently stores any image, so a photo-filled circle would render empty. The curated icon set meets the visual requirement now; photographs are the named upgrade path.
- AVIF is supported only if it can be validated as rigorously as the existing formats by content inspection. If it cannot, JPEG/PNG/WebP alone satisfies the requirement.
- Product photo sets are additive: the first photo is the existing primary image, so no existing business changes behaviour or breaks a known image URL.
- The Arabic-first right-to-left experience remains primary; English is the secondary direction, and both must be correct.
- The homepage continues to be static marketing content with baked-in Arabic-default text, enhanced at runtime where needed, and does not gain a full internationalisation framework.
- Public pages remain honest: any figure shown traces to a real platform record.
- No payment gateway, guest-account requirement, or additional order channel is introduced.
- Visual verification is performed against a running instance with real seeded data at the required viewport widths, not against source inspection alone.

## Out of Scope

- Copying any reference site's code, assets, logos, text, or proprietary graphics.
- Rebuilding the backend, changing API contracts for existing consumers, or migrating away from the current server architecture.
- Adding a payment gateway, customer accounts, or loyalty programmes.
- A native mobile application.
- Per-product or per-category translation authoring interfaces.
- Uploaded category photographs for the circular rail (deferred; see Assumptions).
- New persisted product-detail fields such as calories, ingredients or allergens.
- New analytics, marketing, or sales capabilities beyond what the homepage needs to state the product honestly.
