# Offline action queue persisted in IndexedDB

When a write action is attempted while offline, the action is serialized and stored in IndexedDB. On reconnection, queued actions are replayed with exponential backoff (1s → 2s → 4s → ... → 30s max). A "Syncing..." indicator is shown during replay.

## Considered Options

**In-memory queue only.** Actions live in a JavaScript array and are lost on page refresh. Rejected: a user who refreshes while offline loses all queued work with no recovery path.

**No queue — block all actions offline.** The current PRD baseline: offline = read-only. Rejected for micro-coupures (brief connectivity drops mid-action). The queue ensures that an action in progress when connectivity flickers is not lost.

**Service worker background sync.** Use the Background Sync API to replay actions via the service worker. Rejected: limited browser support, complex coordination with the app's state, and unnecessary for the scale of this app.

## Consequences

- Queued actions survive page refreshes, which is critical for mobile users who may inadvertently close the app.
- IndexedDB is available in all modern browsers and works offline by design, making it the natural choice.
- The exponential backoff prevents thundering-herd problems if many clients reconnect simultaneously.
- Each queued action must include enough context (table, operation, payload) to be replayed independently of the app's current state.
