# Concurrent edits resolved by silent last-write-wins

When both household members modify the same item simultaneously, the last write recorded in the database wins. No conflict UI is shown, no notification is given, and no merge is attempted.

## Considered Options

**Optimistic locking with conflict notification.** Add a version column; reject writes where the version has changed, notify the user. Rejected: over-engineered for a two-person household. The PRD explicitly defers conflict resolution to V2 and describes last-write-wins as the V1 policy.

**Diff dialog.** Show both versions and let the user choose. Rejected: interrupts flow for an event that is rare in a two-person household. The PRD's "les autres risques inhérents à l'égalité totale sont volontairement laissés à la gestion du couple" makes the design intent clear.

## Consequences

- The `updated_at` column on items is the sole arbiter of recency; the most recent write always prevails.
- Users may occasionally see a value change without explanation when the other member edited the same item. This is acceptable for V1.
- A future V2 could introduce optimistic locking or a conflict resolution UI without changing the data model — the `updated_at` column is already in place.
