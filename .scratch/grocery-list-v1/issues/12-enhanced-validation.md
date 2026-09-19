# T1F: Enhanced validation rules

**What to build:** Implement all spec validation rules across every form in the application.

**Blocked by:** T0 (schema migration), T1A (seed defaults for uniqueness checks)

**Status:** ready-for-agent

- [ ] All name fields (item, category, household, first/last name): ≥1 letter, ≤50 chars
- [ ] Reject entries composed only of numbers or symbols
- [ ] Item name uniqueness: case-insensitive across entire household, including vs. un-forked defaults
- [ ] Custom category name uniqueness: case-insensitive within household
- [ ] Quantity/threshold: non-negative integers only, no decimals
- [ ] Threshold: strictly > 0 (mandatory)
- [ ] Unit change: clears quantity and threshold fields
- [ ] Category deletion blocked if non-empty
- [ ] All deletions (items, account, household leave): explicit confirmation dialog
- [ ] Error messages displayed inline near the relevant field
- [ ] `data-testid` attributes: `error-name-required-letter`, `error-name-too-long`, `error-name-duplicate`, `error-threshold-required`, `error-quantity-negative`, `error-category-not-empty`
