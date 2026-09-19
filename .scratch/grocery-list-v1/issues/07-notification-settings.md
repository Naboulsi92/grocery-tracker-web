# T3C: Notification settings page

**What to build:** A `/settings/notifications` screen for managing push notification preferences and daily reminder scheduling.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] Create `/settings/notifications` page with:
  - Push notification toggle (enable/disable)
  - Badge count toggle (enable/disable)
  - "Both" option (push + badge)
  - Daily reminder toggle + time picker (only active if to-buy list is non-empty)
- [ ] Preferences saved to user profile record in database
- [ ] Existing `usePushNotifications` hook: expose `unsubscribe` function to UI (currently only subscribe is exposed)
- [ ] "Désactiver" button appears when notifications are granted
- [ ] `data-testid` attributes: `notification-push-toggle`, `notification-badge-toggle`, `notification-reminder-toggle`, `notification-reminder-time`, `notification-save-button`
- [ ] Page accessible from home dashboard or account settings
