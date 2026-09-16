# Fork applies only to items, not categories

Default items are forked (copied per-household) when a household modifies them. Default categories are never forked — they are fully immutable in name and existence. Households can only reorder default categories via drag-and-drop.

## Considered Options

**Fork both items and categories.** Rejected: the PRD explicitly states default categories are "ni modifiables ni supprimables." Forking categories would require a fork flag, UI for editing/forking, and a way to distinguish forked from original categories — unnecessary complexity for a feature the PRD deliberately excludes.

**No forking at all.** Rejected: without forking, modifying a default item (e.g., renaming "Lait" to "Lait entier") would change the name for all households, which is unacceptable.

## Consequences

- The fork mechanism is item-only, keeping the data model simpler and the PRD aligned.
- Default categories are immutable in name and existence; the only household-level customization is display order via the `category_positions` junction table.
- A custom category cannot share a name with a default category for the same household (case-insensitive unique constraint on (`household_id`, `name`) for custom categories).
