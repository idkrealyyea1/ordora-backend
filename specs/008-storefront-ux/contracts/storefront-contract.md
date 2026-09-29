# Storefront Presentation Contract (no API change)

All payloads, URLs, and checkout contracts stand exactly as in Tasks 1–3.

## Identity block (per storefront load)

- Renders: name, logo/cover (or letter fallback), open/closed status (+ closed notice when shut), description (when set), address (when set), delivery groups (when delivery enabled), contact phone/whatsapp links (when set).
- Omits: any unset element leaves no gap or placeholder; no type badge ever renders.

## Discovery (per menu view)

- Categories with single obvious active state; position and cart retained across switches.
- Search on every storefront, labeled in both languages, live-filtering name/description with empty-state copy.
- Cards show price in business currency, availability state; soldout cards expose no add control to any input path.

## Cart and checkout (per overlay state)

- Bar pill and overlay always show units and totals; pickup/delivery toggle updates subtotal/fee/total immediately; delivery-gated fields appear only for delivery.
- Submit paths (site + WhatsApp), validation messages, success tracking code: unchanged.

## Accessibility surface (per interaction)

- Labeled search; polite live regions on bar pill and overlay total; focus moves into the modal on open and returns to the invoking control on close; visible focus on all interactive elements; full keyboard path with no traps.
