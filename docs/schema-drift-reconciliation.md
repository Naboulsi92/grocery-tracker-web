# Schema Drift Reconciliation Report

## Issue #55: Réconcilier la derive de schema residuelle

### Overview
This document summarizes the schema drift reconciliation performed to align the production database with canonical migration definitions.

### Drift Items Identified and Reconciled

#### 1. Signup Trigger Function ✅
**Issue:** `handle_new_user()` was in public schema instead of private
**Action:** Moved function from `public.handle_new_user()` to `private.handle_new_user()`
**Impact:** No application behavior change - trigger continues to work identically

#### 2. Profile Visibility Helper ✅
**Issue:** Missing `private.can_view_profile(uuid)` function
**Action:** Created the missing helper function
**Impact:** Enables proper profile visibility RLS policies

#### 3. Missing Triggers ✅
**Issue:** Three triggers were missing:
- `profiles_normalize_display_name`
- `profiles_set_updated_at`
- `push_subscriptions_set_updated_at`

**Action:** Created all three missing triggers
**Impact:** Ensures data integrity and automatic timestamp updates

#### 4. Item Audit Trigger ✅
**Issue:** `trigger_update_last_modified` only fired on UPDATE, not INSERT
**Action:** Changed to `before insert or update` to record modifier on both operations
**Impact:** Item inserts now properly record `last_modified_by` and `last_modified_at`

#### 5. Realtime Publication Membership ✅
**Issue:** Empty publication (no tables published)
**Action:** Added `categories` and `items` to `supabase_realtime` publication
**Impact:** Realtime features now work for inventory tables

#### 6. Pre-existing Permission Drift ✅
**Issue:** Multiple permission issues from earlier deployments:
- `anon` could execute `create_household_invitation`
- Direct table grants to `authenticated` role
- Overly permissive column grants on multiple tables

**Action:** 
- Revoked PUBLIC execute on `create_household_invitation`
- Revoked all direct table grants to `authenticated`
- Re-granted only the specific column permissions required by the security contract

**Impact:** Security posture improved to match canonical definition

### Migration Applied
File: `supabase/migrations/20260909000000_reconcile_schema_drift.sql`

### Security Contract Verification
✅ All security contract tests PASSED

The following checks were verified:
- Realtime publication contains only `categories` and `items`
- Non-inventory tables are NOT published to realtime
- Inventory tables use full replica identity
- All public functions are executable only by `authenticated` role
- `anon` cannot execute any public functions
- Trigger functions are not client-executable
- Private schema is not directly accessible
- No forbidden direct table grants
- Column-level permissions match the security contract
- Generated columns (id, timestamps) are not writable by authenticated users

### Accepted Deviations
None - all drift items were reconciled to canonical definitions.

### Application Behavior Impact
**No application behavior changes.** All changes align the database with the canonical migration definitions that the application was already designed to use.

### Next Steps
1. ✅ Migration applied to production database
2. ✅ Security contract tests passing
3. ⏳ Create PR for version control (DO NOT MERGE)
4. ⏳ Document in CHANGELOG if needed

### Files Modified
- `supabase/migrations/20260909000000_reconcile_schema_drift.sql` (new)
- Database schema (via migration)

### Verification Commands
```sql
-- Check functions
SELECT n.nspname, p.proname 
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname IN ('public', 'private') 
ORDER BY n.nspname, p.proname;

-- Check triggers
SELECT tgrelid::regclass, tgname 
FROM pg_trigger 
WHERE tgrelid::regclass::text LIKE 'public.%' 
  AND tgname NOT LIKE 'RI_ConstraintTrigger%'
ORDER BY tgrelid::regclass::text, tgname;

-- Check realtime publication
SELECT schemaname, tablename, pubname 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

---
**Date:** 2026-09-09
**Migration Version:** 20260909000000
**Status:** ✅ Complete and Verified
