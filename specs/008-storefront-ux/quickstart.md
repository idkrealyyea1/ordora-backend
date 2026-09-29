# Quickstart: Storefront UX (Task 4)

**Feature**: `specs/008-storefront-ux/spec.md` | Contracts: `contracts/` | Data model: `data-model.md`

## Prerequisites

- Tasks 1–3 implemented in the working tree. Disposable test database via explicit target for API suites; a small-screen browser (or emulation) plus keyboard-only pass for presentation checks.

## Validate end to end

1. **Identity**: load each business type with full and with missing optional assets; confirm name, logo/cover, status, description, and contact render together (or omit cleanly) on the first screen.
2. **Discovery**: browse categories, search (matches + no-match), and confirm position retention, cart preservation, and soldout non-orderability including rapid taps.
3. **Cart confidence**: build a mixed cart, toggle pickup/delivery, and confirm subtotal/fee/total in business currency at bar, overlay, and confirmation; complete guest checkout and track the order.
4. **Accessibility**: keyboard-only full journey with visible focus; live-region announcements on cart/total changes; focus move/return on overlay open/close; 200% text scaling; RTL and English passes.
5. **Performance**: confirm zero new assets/requests/animations versus baseline; skeleton and offline/retry behavior intact on throttled connection.
6. **Regression gates**: `npm run check` passes with 0 failures; full API suite green against the disposable database only.

## References

- Presentation contract: `contracts/storefront-contract.md`
- Decisions and rejected alternatives: `research.md`
