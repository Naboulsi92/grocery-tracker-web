# History cap enforced by database trigger

The 20-entry history rotation is enforced by a PostgreSQL `AFTER INSERT` trigger on the history table, not by the application layer. When a 21st entry is inserted for a household, the trigger automatically deletes the oldest entry.

## Considered Options

**Application-layer enforcement.** The app inserts the new entry then deletes rows beyond 20. Rejected: vulnerable to race conditions when two clients write simultaneously — both could insert before either deletes, resulting in 21+ rows until the next cleanup.

**Database function called by the app.** The app calls a function that inserts and trims in one transaction. Rejected: adds an unnecessary round-trip and couples the app to a specific function signature. The trigger approach is zero-cost from the app's perspective.

## Consequences

- The history table is guaranteed to stay at ≤20 rows per household regardless of concurrent writes.
- The trigger must be included in every migration that touches the history table schema.
- The app simply inserts history rows; it never needs to query for or delete old entries.
