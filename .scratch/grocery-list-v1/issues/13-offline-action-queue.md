# T2D: Offline action queue

**What to build:** Queue write actions in IndexedDB when offline. Replay them with exponential backoff on reconnection. Show syncing indicator during replay.

**Blocked by:** T1D (offline read-only foundation)

**Status:** ready-for-agent

- [ ] IndexedDB database for queued actions: stores operation type, table, payload, timestamp
- [ ] When offline, write actions are serialized and stored in IndexedDB instead of being sent to Supabase
- [ ] On reconnection, queued actions replay in order with exponential backoff (1s → 2s → 4s → ... → 30s max)
- [ ] "Syncing..." indicator shown during replay
- [ ] Queue survives page refresh (IndexedDB persistence)
- [ ] Failed actions after max retries: notify user, keep in queue for manual retry
- [ ] Queue actions include enough context to replay independently of app state
- [ ] `data-testid` attributes: `syncing-indicator`, `queue-pending-count`
