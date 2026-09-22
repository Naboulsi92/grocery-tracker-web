-- Repair: converge a diverged pre-V1.1 remote towards the canonical baseline.
--
-- Context: the remote project was migrated with variant files (same logical
-- steps, different versions) that skipped the secure-model constraints, RLS
-- policies and least-privilege grants. Symptoms on that remote: every
-- authenticated query fails with 42501 (no GRANT on household_members, anon
-- still holds ALL privileges) while V1.1 cannot apply (it drops
-- items_category_household_fkey unconditionally, a constraint the variant
-- chain never created).
--
-- Fully idempotent: every statement is guarded (IF NOT EXISTS / IF EXISTS /
-- CREATE OR REPLACE / repeatable REVOKE+GRANT / DO-block existence checks),
-- so this is a strict no-op on a converged chain (fresh `supabase db reset`
-- + `migration up`). It is deliberately positioned BEFORE V1.1 (timestamp
-- 20260914 < 20260915): it re-asserts the pre-V1.1 canonical state
-- (secure_household_model + reconcile_schema_drift), which V1.1 then evolves.
--
-- Verif CI : psql -v ON_ERROR_STOP=1 -f supabase/tests/database/security_contract.sql

-- ── 0. Private schema hygiene (canonical secure-model) ─────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── 1. Composite category FK (canonical secure-model) ──────────────────────
-- V1.1 §7 drops items_category_household_fkey unconditionally and §11
-- re-adds it on top of categories_id_household_id_key: both must exist here.
-- Existing rows were audited clean (no cross-household item->category), so
-- the ADD CONSTRAINT validates without a data migration.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_id_household_id_key') then
    alter table public.categories
      add constraint categories_id_household_id_key unique (id, household_id);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_category_household_fkey') then
    if exists (select 1 from pg_constraint where conname = 'items_category_id_fkey') then
      alter table public.items drop constraint items_category_id_fkey;
    end if;
    alter table public.items
      add constraint items_category_household_fkey
      foreign key (category_id, household_id)
      references public.categories (id, household_id)
      on delete set null (category_id);
  end if;
end;
$$;

-- ── 2. Canonical RLS helpers (CREATE OR REPLACE = convergence) ─────────────
-- is_household_member: the diverged chain named the argument p_household_id,
-- which CREATE OR REPLACE cannot rename (42P13). Drop (CASCADE) + recreate
-- when the signature differs. CASCADE side effects are re-created below
-- (policies, §3) or by V1.1 §15/§21-23 and the #106-#107 migrations
-- (invitation RPCs). No-op when the signature already matches.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'is_household_member'
      and p.proargnames::text is distinct from '{target_household_id}'
  ) then
    execute 'drop function private.is_household_member(uuid) cascade';
  end if;
end;
$$;

create or replace function private.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create or replace function private.can_view_profile(target_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members actor_membership
    join public.household_members target_membership
      on target_membership.household_id = actor_membership.household_id
    where actor_membership.user_id = auth.uid()
      and target_membership.user_id = target_user_id
  );
$$;

-- Dead since V1.1 §24 (PRD §11 household equality): drop, never recreate.
drop function if exists private.is_household_owner(uuid);

revoke all on function private.is_household_member(uuid) from public, anon, authenticated;
revoke all on function private.can_view_profile(uuid) from public, anon, authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;

-- ── 3. Canonical member policies ───────────────────────────────────────────
-- Drop the legacy permissive policies (initial_schema, TO public / anon).
drop policy if exists "Users can view their own households" on public.households;
drop policy if exists "Users can insert households they belong to" on public.households;
drop policy if exists "Users can view their own membership" on public.household_members;
drop policy if exists "Users can join households" on public.household_members;
drop policy if exists "Users can view categories in their households" on public.categories;
drop policy if exists "Users can manage categories in their households" on public.categories;
drop policy if exists "Users can view items in their households" on public.items;
drop policy if exists "Users can manage items in their households" on public.items;
drop policy if exists "Users can manage their own push subscriptions" on public.push_subscriptions;

-- Drop canonical names first so the CREATEs below are re-runnable on a
-- converged chain (strict no-op there).
drop policy if exists households_select_member on public.households;
drop policy if exists households_update_owner on public.households;
drop policy if exists household_members_select_member on public.household_members;
drop policy if exists profiles_select_household on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists categories_select_member on public.categories;
drop policy if exists categories_insert_member on public.categories;
drop policy if exists categories_update_member on public.categories;
drop policy if exists categories_delete_member on public.categories;
drop policy if exists items_select_member on public.items;
drop policy if exists items_insert_member on public.items;
drop policy if exists items_update_member on public.items;
drop policy if exists items_delete_member on public.items;
drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_self on public.push_subscriptions;
drop policy if exists push_subscriptions_update_self on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_self on public.push_subscriptions;

create policy households_select_member on public.households for select to authenticated
using (private.is_household_member(id));
-- Transitional: keeps the pre-V1.1 name but already gates on membership
-- (is_household_owner is dead code, dropped above). V1.1 §24 drops this
-- policy and creates households_update_member.
create policy households_update_owner on public.households for update to authenticated
using (private.is_household_member(id))
with check (private.is_household_member(id));

create policy household_members_select_member on public.household_members for select to authenticated
using (private.is_household_member(household_id));

create policy profiles_select_household on public.profiles for select to authenticated
using (
  private.can_view_profile(id)
);
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy categories_select_member on public.categories for select to authenticated
using (private.is_household_member(household_id));
create policy categories_insert_member on public.categories for insert to authenticated
with check (private.is_household_member(household_id));
create policy categories_update_member on public.categories for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));
create policy categories_delete_member on public.categories for delete to authenticated
using (private.is_household_member(household_id));

create policy items_select_member on public.items for select to authenticated
using (private.is_household_member(household_id));
create policy items_insert_member on public.items for insert to authenticated
with check (private.is_household_member(household_id));
create policy items_update_member on public.items for update to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));
create policy items_delete_member on public.items for delete to authenticated
using (private.is_household_member(household_id));

create policy push_subscriptions_select_self on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_self on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()) and endpoint = subscription ->> 'endpoint');
create policy push_subscriptions_update_self on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and endpoint = subscription ->> 'endpoint');
create policy push_subscriptions_delete_self on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

-- ── 4. Canonical least-privilege grants (reconcile §7) ─────────────────────
-- Anon must hold nothing on app tables (the variant chain granted ALL).
revoke all on public.households, public.household_members, public.categories, public.items,
  public.units, public.profiles, public.household_invitations, public.push_subscriptions from anon;

-- Function execute hygiene (reconcile §7a).
revoke all on function public.create_household_invitation(uuid, interval) from public;
revoke all on function public.create_household_invitation(uuid, interval) from anon;
grant execute on function public.create_household_invitation(uuid, interval) to authenticated;

-- Authenticated: revoke-then-grant minimal columns (reconcile §7b-7g).
revoke all on table public.household_invitations from authenticated;
revoke all on table public.household_members from authenticated;
revoke all on table public.households from authenticated;

-- Grant SELECT on household_members to allow authenticated users to verify membership
grant select on table public.household_members to authenticated;

revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit_id, low_stock_threshold) on table public.items to authenticated;
grant update (name, category_id, unit_id, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

revoke all on table public.categories from authenticated;
grant select on table public.categories to authenticated;
grant insert (household_id, name, icon, "order") on table public.categories to authenticated;
grant update (name, icon, "order") on table public.categories to authenticated;
grant delete on table public.categories to authenticated;

revoke all on table public.push_subscriptions from authenticated;
grant select on table public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, subscription) on table public.push_subscriptions to authenticated;
grant update (endpoint, subscription) on table public.push_subscriptions to authenticated;
grant delete on table public.push_subscriptions to authenticated;

revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

revoke all on table public.households from authenticated;
grant select on table public.households to authenticated;
grant update (name) on table public.households to authenticated;

-- ── 5. Profile triggers (reconcile §3) ─────────────────────────────────────
create or replace function private.normalize_profile_display_name() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.display_name = nullif(left(btrim(new.display_name), 80), '');
  return new;
end;
$$;
revoke all on function private.normalize_profile_display_name() from public, anon, authenticated;

drop trigger if exists profiles_normalize_display_name on public.profiles;
create trigger profiles_normalize_display_name before insert or update on public.profiles
for each row execute function private.normalize_profile_display_name();

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function private.set_updated_at();

-- ── 6. Realtime publication + replica identity (reconcile §5-6) ────────────
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'categories'
  ) then
    alter publication supabase_realtime add table public.categories;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;

do $$
declare
  non_inventory_table text;
begin
  foreach non_inventory_table in array array[
    'households', 'household_members', 'profiles', 'household_invitations',
    'push_subscriptions', 'units'
  ] loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = non_inventory_table
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', non_inventory_table);
    end if;
  end loop;
end;
$$;

alter table public.categories replica identity full;
alter table public.items replica identity full;

-- ── 7. Backfill profiles for pre-trigger users (secure-model) ──────────────
insert into public.profiles (id, display_name, created_at, updated_at)
select id,
  nullif(left(btrim(coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name')), 80), ''),
  coalesce(created_at, now()), now()
from auth.users
on conflict (id) do nothing;

notify pgrst, 'reload schema';
