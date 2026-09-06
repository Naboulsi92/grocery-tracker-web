# Ticket #52 Implementation Tasks

## Status: Implementation appears complete

### Completed:
- [x] "Désactiver" button for push notifications in HomePage (`src/app/home/page.tsx:150-157`)
- [x] Members link pointing to `/members` in HomePage dashboard (`src/app/home/page.tsx:118`)
- [x] Members page created at `src/app/members/page.tsx` with:
  - Household members list display
  - Invite code display with copy-to-clipboard
  - Create/revoke invitation functionality
  - Member info (name, role, join date)
- [x] Members layout with PrivateRoute at `src/app/members/layout.tsx`

### Verification:
- [x] TypeScript typecheck: PASSES
- [x] ESLint: 29 warnings (pre-existing, no errors)
- [ ] Test review needed

### Test Status:
- members-page.test.tsx: 1 failure - "creates, copies and revokes an opaque invitation without truncating it" - needs investigation
- use-push-notifications.test.tsx: 3 failures - likely VAPID key/config environment issues
- marketing/faq.test.tsx: 2 failures - pre-existing locale/text issues

### Next Steps:
1. Investigate and fix members-page test failure
2. Run final code review
3. Commit and push
4. Update ticket status