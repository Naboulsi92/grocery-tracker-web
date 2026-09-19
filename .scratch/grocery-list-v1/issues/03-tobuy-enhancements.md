# T1B: To-buy list enhancements

**What to build:** Enhance the to-buy list to match spec: checked items persist until user leaves screen, manual quantity entry (not just +1), and check-off only when new qty strictly exceeds threshold.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

- [ ] Checked items remain visible with completion visual until user navigates away from `/to-buy`
- [ ] Replace simple "+1 restock" button with manual quantity entry (tap to type purchased quantity)
- [ ] Check-off triggers only when entered quantity > threshold (not on any quantity change)
- [ ] Empty state shows positive message ("Tout est en stock" / "Everything is in stock")
- [ ] Add `data-testid` attributes: `tobuy-item-row-{name}`, `tobuy-quantity-input`, `tobuy-check-button`
- [ ] Offline: to-buy list is readable but actions disabled (connects to T1D offline banner)
