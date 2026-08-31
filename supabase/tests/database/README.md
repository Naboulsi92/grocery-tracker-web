# Database security contract

Run the contract against a fresh local Supabase database:

```sh
npx supabase start
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f supabase/tests/database/security_contract.sql
```

An upgrade test should also restore a copy of the schema at migration
`20260830181437`, seed representative historical data, and then apply
`20260831120000`. Cover these cases separately:

1. Every household has at least one member: the migration succeeds and assigns
   exactly one owner per household.
2. A household has no members: the migration fails with SQLSTATE `23514`, lists
   sample orphan household IDs, and suggests adding memberships before retrying.
3. Existing users have blank or longer-than-80-character display names: profile
   backfill stores `NULL` for blank names and trims other names to 80 characters.
4. `pgcrypto` and `uuid-ossp` are absent or installed outside `extensions`: both
   migrations still apply because application UUIDs and hashes use PostgreSQL 17
   built-ins rather than extension-schema-qualified functions.

Docker and the Supabase CLI are required for these replay and upgrade checks.
