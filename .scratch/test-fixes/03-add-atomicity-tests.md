# 03: Add concurrent increment/decrement atomicity tests

**What to build:** Add tests that verify atomic increment/decrement operations work correctly under concurrent access, ensuring no race conditions cause data loss.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Create test that simulates concurrent increment operations from multiple browser contexts
- [ ] Verify final quantity equals expected value after all concurrent operations complete
- [ ] Add similar test for concurrent decrement operations
- [ ] Test mixed concurrent increment/decrement scenarios