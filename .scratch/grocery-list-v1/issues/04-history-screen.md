# T2B: History table and screen

**What to build:** Display the 20 most recent modification and deletion actions per household. History entries show actor, action type, item name, and relative timestamp. Purchases are not logged.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] Create `/history` page showing last 20 actions
- [ ] Each entry displays: who performed the action, what action (modified/suppressed), which item, and when (relative timestamp)
- [ ] History entries are inserted by application code after item modifications and deletions
- [ ] DB trigger enforces 20-entry cap (implemented in T0)
- [ ] Empty state message when no history exists
- [ ] `data-testid` attributes: `history-entry-{index}`, `history-empty-state`
- [ ] Page accessible from home dashboard (add link/card)
