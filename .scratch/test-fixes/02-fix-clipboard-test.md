# 02: Fix clipboard test robustness

**What to build:** Make the clipboard test handle potential clipboard access failures gracefully, especially in cross-origin iframe contexts common in CI.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Wrap clipboard read in try-catch to handle PermissionDeniedError
- [ ] Add fallback verification: check that "Copié !" success message appears instead of relying solely on clipboard read
- [ ] Consider using Playwright's clipboard API which handles permissions better