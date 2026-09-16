# T1C: Household settings page

**What to build:** A `/household` settings screen where members can rename the household, view members, access the invite code, and leave the household.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] Create `/household` page with:
  - Household name field (auto-generated as "Foyer {last_name}", editable, max 50 chars, ≥1 letter)
  - Save button for name changes
  - Members list showing both members (name, email)
  - Invite code section: show code + QR code, regenerate button with confirmation dialog
  - "Foyer complet" state when 2/2 members (invite section hidden or disabled)
  - Leave household button with confirmation: "You will lose access to inventory. The other member keeps all data."
- [ ] Invite code: 8-char alphanumeric, shown once at creation, regeneration requires confirmation
- [ ] `data-testid` attributes: `household-name-input`, `household-name-save-button`, `invite-code-display`, `invite-code-regenerate-button`, `invite-code-regenerate-confirm`, `leave-household-button`, `leave-household-confirm`
- [ ] Page accessible from home dashboard
