# 01: Fix delete failure test to use real error simulation

**What to build:** Replace the fragile `window.__supabaseError` injection in the delete failure test with proper network error simulation using Playwright's route interception.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Replace `window.__supabaseError` injection with Playwright `page.route()` to intercept and fail the delete API call
- [ ] Verify the test still catches the error message displayed to users
- [ ] Ensure test is deterministic and doesn't depend on test-specific window properties