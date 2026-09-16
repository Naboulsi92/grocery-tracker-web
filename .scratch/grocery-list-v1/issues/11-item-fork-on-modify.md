# T3A: Item fork-on-modify

**What to build:** When a household modifies a default item (rename, change unit/threshold), a forked copy is created for that household. The original default item remains untouched. Item name uniqueness enforced across all household items including un-forked defaults.

**Blocked by:** T1A (seed defaults), T2A (category management)

**Status:** ready-for-agent

- [ ] Modifying a default item creates a forked copy in the household's items table (not modifying the global default)
- [ ] Inventory screen shows: default items (unmodified) + forked items (household-customized)
- [ ] Renaming a default item forks it automatically
- [ ] Changing unit or threshold on a default item forks it automatically
- [ ] Item name uniqueness: case-insensitive unique constraint on (`household_id`, `name`) — prevents creating duplicate names including vs. un-forked defaults
- [ ] Validation: item name must contain ≥1 letter, ≤50 chars
- [ ] Unit change clears quantity and threshold (user must re-enter)
- [ ] `data-testid` attributes: `item-name-input`, `item-category-select`, `item-unit-select`, `item-quantity-input`, `item-threshold-input`, `item-save-button`, `item-delete-button`, `item-delete-confirm`, `item-forked-badge`
