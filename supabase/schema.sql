-- Canonical schema snapshot.
--
-- This repository keeps the snapshot executable and drift-free by replaying the
-- immutable migrations in order. Run this file with psql from this directory;
-- Supabase deployments should continue to use `supabase db push`.
\ir migrations/20260830181437_initial_schema.sql
\ir migrations/20260831120000_secure_household_model.sql
