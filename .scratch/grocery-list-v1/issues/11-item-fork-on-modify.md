# T3A: Item fork-on-modify

> **SUPERSEDED (PHASE 2, C9):** Fork-on-modify is removed from scope. The PRD
> (v1.4, §5) declares the catalog link "à titre indicatif uniquement, sans effet
> fonctionnel". Items seed once per household at creation and are otherwise
> independent; no fork flag, fork badge, or runtime forking exists. Unique
> naming and unit/quantity/threshold clearing rules listed below are unchanged
> and live outside this ticket. See ADR-0004.

**What to build (original):** When a household modifies a default item (rename, change unit/threshold), a forked copy is created for that household. The original default item remains untouched. Item name uniqueness enforced across all household items including un-forked defaults.

**Blocked by:** T1A (seed defaults), T2A (category management)

**Status:** superseded

- [x] Modifying a default item creates a forked copy in the household's items table (not modifying the global default) — *replaced by seed-at-creation*
- [ ] Inventory screen shows: default items (unmodified) + forked items (household-customized)
- [ ] Renaming a default item forks it automatically
- [ ] Changing unit or threshold on a default item forks it automatically
- [ ] Item name uniqueness: case-insensitive unique constraint on (`household_id`, `name`) — prevents creating duplicate names including vs. un-forked defaults
- [ ] Validation: item name must contain ≥1 letter, ≤50 chars
- [ ] Unit change clears quantity and threshold (user must re-enter)
- [ ] `data-testid` attributes: `item-name-input`, `item-category-select`, `item-unit-select`, `item-quantity-input`, `item-threshold-input`, `item-save-button`, `item-delete-button`, `item-delete-confirm`, `item-forked-badge`
