# T0: Database schema migration to V1.1

**What to build:** Migrate the existing Supabase schema to support the V1.1 feature set while preserving all existing data. This is the foundation every other ticket depends on.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Schema changes

- [ ] Create `default_categories` table: `id`, `name_fr`, `name_en`, `position` (global, not household-scoped)
- [ ] Create `default_items` table: `id`, `name_fr`, `name_en`, `default_category_id` FK, `unit`, `threshold` (global)
- [ ] Add `is_default` boolean to existing `categories` table (false = custom, true = seeded default)
- [ ] Remove `icon` and `order` columns from `categories` (replaced by `category_positions`)
- [ ] Create `category_positions` junction table: `household_id`, `category_id`, `position` — enables per-household ordering for all categories
- [ ] Create `history` table: `id`, `household_id`, `performed_by` (user FK), `action_type` (enum: modification, suppression), `item_name`, `performed_at`
- [ ] Create `AFTER INSERT` trigger on `history` to enforce 20-entry cap per household (delete oldest beyond 20)
- [ ] Add `already_notified` boolean (default false) to `items` table
- [ ] Add `notification_type` enum column (`push`, `badge`, `both`) to `users`/`profiles` table
- [ ] Add `reminder_time` time column to `users`/`profiles` table
- [ ] Add `language` enum column (`fr`, `en`) to `users`/`profiles` table
- [ ] Add `deleted_at` timestamp (nullable) to `users`/`profiles` table for soft-delete
- [ ] Add `unit` string column to `items` (replacing `unit_id` FK) with values: `kg`, `g`, `l`, `ml`, `unite`
- [ ] Migrate existing item data from `unit_id` to new `unit` string column
- [ ] Drop `unit_id` foreign key and `units` table after migration
- [ ] Add `ON DELETE RESTRICT` constraint on category deletion when items exist
- [ ] Enforce max 2 members per household (DB constraint or trigger)
- [ ] Update invite code: change token format, add `attempts` counter column, update expiry default to 24h
- [ ] Add `Cascade-delete` logic: when household has 0 members, delete household's custom categories, forked items, and history
- [ ] Verify all existing RLS policies still work after schema changes
- [ ] Run `supabase/tests/database/security_contract.sql` conceptually to verify no regressions

## Deliverables

- [ ] Migration file in `supabase/migrations/` that applies cleanly
- [ ] Existing data preserved (existing items/categories/households intact)
- [ ] `src/types/database.ts` updated to reflect new schema
