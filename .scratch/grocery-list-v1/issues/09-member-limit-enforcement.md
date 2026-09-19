# T2G: Household member limit enforcement

**What to build:** Enforce the V1 constraint of exactly 2 members per household at both the database and UI level. Improve invite code UX.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] DB: constraint or trigger prevents inserting a 3rd member into any household
- [ ] UI: when household is full (2/2), invite code/QR section shows "Foyer complet" and is disabled
- [ ] Invalid or expired invite code shows clear error message ("Code invalide ou expiré")
- [ ] Invite code lockout: 5 failed attempts → 1-minute temporary block
- [ ] QR code deep link: scanning QR opens app with invite code pre-filled (no manual entry needed)
- [ ] `data-testid` attributes: `household-full-message`, `invite-code-error`, `invite-code-locked-message`
