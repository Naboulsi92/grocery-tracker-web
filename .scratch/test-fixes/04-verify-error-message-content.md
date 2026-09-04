# 04: Verify specific error message content in validation tests

**What to build:** Update the create failure test (US 52) to verify specific error message content instead of just checking that an alert is visible.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Update test to check for specific error message text (e.g., "Le nom de l'article est requis")
- [ ] Test both empty and whitespace-only input scenarios with their respective messages
- [ ] Add tests for actual create failures (network errors, database errors) beyond form validation