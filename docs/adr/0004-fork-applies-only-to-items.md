# Items seed at creation; no fork-on-modify (ADR-0004)

Default items are copied (seeded) into each household **at creation** from the shared `item_templates` catalog. After creation, household items are fully independent: there is no link back to the catalog (no fork flag, no fork-on-modify), and modifying a seeded item never affects any other household. Default categories are never forked — they are fully immutable in name and existence. Households can only reorder default categories via drag-and-drop.

## Considered Options

**Fork items and categories on modification.** Rejected: the PRD explicitly states default categories are "ni modifiables ni supprimables." Forking categories would require a fork flag, UI for editing/forking, and a way to distinguish forked from original categories — unnecessary complexity for a feature the PRD deliberately excludes.

**Fork items but not categories (original ADR-0004).** Replaced: it motivated a fork-on-modify mechanism that linked household items to their catalog origin (`items.template_id` + a "forked" badge). The PRD later clarified that the template link is "à titre indicatif uniquement, sans effet fonctionnel" (PRD §5). Fork-on-modify was therefore removed (PHASE 2 C9) in favor of seed-at-creation.

**No forking at all (seed-at-creation).** Chosen: seeding the catalog per household at creation already isolates households (modifying "Lait" in one household never reaches another). The extra fork-on-modify machinery and its on-screen "forked" indicator added state without a corresponding PRD requirement.

## Consequences

- `create_household` seeds ten default categories plus ten default items per household; nothing is "forked" afterwards.
- `items.template_id` is a purely indicative backfill for pre-existing rows and is not surfaced in the UI.
- Default categories are immutable in name and existence; the only household-level customization is display order via the `category_positions` junction table.
- A custom category cannot share a name with a default category for the same household (case-insensitive unique constraint on (`household_id`, `name`) for custom categories).