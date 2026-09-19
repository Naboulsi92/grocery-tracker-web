# T2C: Account settings page

**What to build:** An `/account` settings screen for profile management, password change, language/dark mode preferences, logout, and account deletion.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] Create `/account` page with:
  - First name / last name fields (editable, max 50 chars, ≥1 letter)
  - Password change section (email accounts only): current password required, new password 8+ chars
  - Language selector (fr/en radio or dropdown)
  - Dark mode toggle (follows OS by default, user override)
  - Sign out button
  - Delete account button → confirmation dialog → soft-delete (7-day retention)
- [ ] Account deletion: sets `deleted_at` timestamp, user can cancel by logging in within 7 days
- [ ] Re-login within 7 days restores account (clears `deleted_at`)
- [ ] After 7 days, scheduled job permanently deletes personal data (cron or edge function)
- [ ] `data-testid` attributes: `account-first-name-input`, `account-last-name-input`, `account-save-button`, `account-change-password-button`, `account-delete-button`, `account-delete-confirm`, `account-language-selector`, `account-dark-mode-toggle`
- [ ] Page accessible from home dashboard
