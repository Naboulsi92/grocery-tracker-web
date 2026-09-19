# T2F: Server-side notification delivery

**What to build:** Detect threshold crossings when items are modified and send push notifications to the non-acting member. Include OS badge count and daily reminder scheduling.

**Blocked by:** T0 (schema migration), T3C (notification preferences)

**Status:** ready-for-agent

- [ ] Server-side (Supabase Edge Function or database trigger): detect when item quantity crosses threshold
- [ ] Only notify the member who did NOT perform the action
- [ ] One notification per threshold crossing (use `already_notified` flag to prevent repeats)
- [ ] `already_notified` resets to false when quantity rises above threshold
- [ ] OS badge count: increment on notification, clear when to-buy list is empty
- [ ] Daily reminder: scheduled notification at user-chosen time, only fires if to-buy list is non-empty
- [ ] Notification payload includes: item name, current quantity, household name
- [ ] `data-testid` attributes: N/A (server-side, tested via integration tests)
