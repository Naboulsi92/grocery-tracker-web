-- Ticket #222 — Unit change really empties quantity + threshold (PRD §4.4).
-- The cleared threshold persists as NULL instead of the sentinel 1:
-- drop the NOT NULL constraint on items.low_stock_threshold.
--
-- NULL-safety of the existing guards (no change needed):
--   * items_threshold_positive  (low_stock_threshold > 0)      → NULL passes
--   * items_threshold_integer   (low_stock_threshold = trunc)   → NULL passes
--   * notify triggers (quantity <= low_stock_threshold)         → NULL never fires
--   * to-buy comparisons (quantity <= low_stock_threshold)      → NULL rows excluded
-- Creates still default to 1 (column DEFAULT kept) and the form still
-- requires a threshold on create — only the cleared-after-unit-change edit
-- may persist NULL until the user re-enters a value.
-- Forward-only, idempotent (DROP NOT NULL on a nullable column is a no-op).

alter table public.items
  alter column low_stock_threshold drop not null;

comment on column public.items.low_stock_threshold is
  'NULL = cleared by a unit change (PRD §4.4), awaiting manual re-entry; otherwise > 0 integer.';

notify pgrst, 'reload schema';
