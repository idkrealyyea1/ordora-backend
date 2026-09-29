# Data Model: Storefront UX (Task 4)

**Feature**: `specs/008-storefront-ux/spec.md` | **Date**: 2026-09-29
No schema. Presentation entities rendered from the existing public view payload.

## Entities (all read-only views of existing fields)

### Storefront

- One page per business slug; mounts: header, hero/content, cart bar, overlay root. Rendered by existing functions; structure unchanged.

### Identity Block

- Name (+ bilingual variant), logo/cover with letter fallback, open/closed status with closed notice, description, address, delivery groups, plus contact phone/whatsapp (newly rendered, already fetched). Each element presence-gated; absent data omits cleanly.

### Product Card

- Name, description, price with business currency context, lazy image with name alt, popular marker, availability state; soldout renders a tag and no action control through any path.

### Cart

- Guest-local entries; bar pill with count/total; overlay with rows, qty controls, pickup/delivery toggle, subtotal/fee/total, checkout form, WhatsApp + site submit, success with tracking code. Totals always rendered, including empty and closed states.

## Validation and states

- Availability, prices, hours, and subscription enforced server-side at checkout as today; client gating mirrors but never replaces it.
- Search filters by name/description on every storefront with empty-state copy; category position and cart survive navigation.

## Tenancy, security, i18n

- No data-access change; existing escaping on every interpolated string; RTL + English via existing dictionaries (search label added in both).
