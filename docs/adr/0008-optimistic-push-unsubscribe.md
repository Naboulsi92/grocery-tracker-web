# Push unsubscribe is optimistic on remote failure

When the user disables push notifications, the local browser subscription is removed first and the server record second. If the server deletion fails, `unsubscribe()` still returns `{ error: null }`: the local operation succeeded and must not be blocked by a server error. The failure is exposed through the sync state (`serverSync === 'error'`, user-friendly message in `error`) so the user can retry.

## Considered Options

**Fail the whole operation on remote error.** Return the server error from `unsubscribe()` and keep the local subscription. Rejected: the user asked to stop notifications — keeping them on because the database was briefly unreachable is the worst outcome, and it leaves the local and remote states disagreeing about what the user wants.

**Silent success.** Return `{ error: null }` and swallow the remote error. Rejected: the orphaned server record would keep the endpoint registered, and the user would have no way to know a retry is needed.

## Consequences

- `unsubscribe()` returning `{ error: null }` means "you will no longer receive notifications on this device", not "the server agrees".
- A failed remote deletion surfaces via `serverSync === 'error'` with a retry path; the next successful sync converges the states.
- Covered by the `usePushNotifications` unit test 'surfaces a remote deletion failure after unsubscribing locally'.
