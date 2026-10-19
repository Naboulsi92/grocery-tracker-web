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
\ir migrations/20260914000000_repair_remote_baseline.sql
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
\ir migrations/20260922000000_compte_foyer_lifecycle.sql
\ir migrations/20260923000000_houseless_self_profile.sql
\ir migrations/20260924000000_cron_auth_grants.sql
\ir migrations/20260925000000_enqueue_due_window.sql
\ir migrations/20260926000000_history_household_performed_idx.sql
\ir migrations/20260927000000_letter_class_harmonization.sql
\ir migrations/20260929000000_email_exists.sql
\ir migrations/20260930000000_auth_provider_for_email.sql
\ir migrations/20260930000001_realtime_household_members.sql
\ir migrations/20261012000000_fork_language.sql
\ir migrations/20261014000000_threshold_nullable.sql
\ir migrations/20261014000001_reminder_badge_none.sql
\ir migrations/20261015000000_lockout_return_status.sql
\ir migrations/20261018000000_threshold_zero_allowed.sql
