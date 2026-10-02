# Contract: Access Rules per Surface and State

This is the behavioral contract every gate implements. Derived state comes from server time only; `== end instant` counts as expired. Nothing is ever deleted on state change.

## Matrix

| State | Storefront (direct link) | Ordering (`POST` checkout/booking) | Tracking past orders | Owner dashboard reads | Owner management writes | Platform admin |
|-------|--------------------------|------------------------------------|----------------------|-----------------------|-------------------------|----------------|
| trial | full menu | accepted | works | full | allowed | full |
| active | full menu | accepted | works | full | allowed | full |
| grace | full menu + owner reminder surface | accepted | works | full | allowed | full |
| expired | visible menu, ordering disabled + simple notice | rejected (`SUBSCRIPTION_EXPIRED`) | works | reachable, restricted guidance shown | blocked (`SUBSCRIPTION_EXPIRED`) | full |
| cancelled (effective) | like expired | like expired | works | like expired | like expired | full |
| cancelled (before effective date) | like active | like active | works | like active | like active | full |
| suspended | controlled unavailable notice | rejected | works | status + contact guidance only | blocked | full |

## Notes

- The public directory and sitemap keep excluding non-active stores (they advertise; the direct link serves) — unchanged behavior.
- Owner login while expired/suspended still authenticates (identity is not access); the dashboard explains state + recovery instead of greeting normally.
- Management-write blocks reuse the existing `SUBSCRIPTION_EXPIRED` code and message shape; suspended uses a distinct message key so owners understand the difference.
- Capability evaluation returns `false` for gated features in expired/cancelled-effective/suspended (via state → entitlement input), so `requireCapability` needs no signature change.
- One-trial-per-business is structural (UNIQUE subscription row per business); repeat claims resolve to the existing record, never a second trial.
