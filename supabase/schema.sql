-- Canonical schema snapshot.
--
-- This repository keeps the snapshot executable and drift-free by replaying the
-- immutable migrations in order. Run this file with psql from this directory;
-- Supabase deployments should continue to use `supabase db push`.
\ir migrations/20260830181437_initial_schema.sql
\ir migrations/20260831120000_secure_household_model.sql
\ir migrations/20260906000000_fix_invitation_functions.sql
\ir migrations/20260909000000_reconcile_schema_drift.sql
\ir migrations/20260909150000_fix_handle_new_user_duplicate.sql
\ir migrations/20260915000000_v1_1_schema.sql
\ir migrations/20260916000000_account_settings_profiles_grants.sql
\ir migrations/20260916010000_item_fork.sql
\ir migrations/20260916020000_server_notifications.sql
\ir migrations/20260917000000_rls_invitations_egalite.sql
\ir migrations/20260918000000_fix_cap_invalidation.sql
\ir migrations/20260919000000_fork_seeds_units_validation.sql
\ir migrations/20260920000000_history_notifs_rotation.sql
\ir migrations/20260920120000_fix_already_notified_default.sql
\ir migrations/20260921000000_offline_lww.sql
