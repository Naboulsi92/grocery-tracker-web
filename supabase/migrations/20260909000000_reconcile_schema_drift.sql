-- Reconcile residual schema drift
-- This migration addresses pre-existing drift that was deliberately excluded from the invitation repair
--
-- Drift items reconciled:
-- 1. Signup trigger function moved from public to private schema
-- 2. Profile visibility helper (can_view_profile) created
-- 3. Missing triggers added (profiles_normalize_display_name, profiles_set_updated_at, push_subscriptions_set_updated_at)
-- 4. Item audit trigger updated to record timestamp AND acting user on INSERT
-- 5. Realtime publication membership fixed (categories and items only)
-- 6. Pre-existing permission drift corrected (function and table grants)

-- 1. Move signup trigger function from public to private schema
-- Drop the public version and create the canonical private version
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')), 80), '')
  );
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

-- 2. Create missing profile visibility helper (private.can_view_profile)
create function private.can_view_profile(target_user_id uuid)
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

revoke all on function private.can_view_profile(uuid) from public, anon, authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

-- 3. Add missing triggers
-- 3a. Profile normalize display name trigger
create function private.normalize_profile_display_name() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.display_name = nullif(left(btrim(new.display_name), 80), '');
  return new;
end;
$$;
revoke all on function private.normalize_profile_display_name() from public, anon, authenticated;

create trigger profiles_normalize_display_name before insert or update on public.profiles
for each row execute function private.normalize_profile_display_name();

-- 3b. Profile set updated_at trigger
create function private.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

-- 3c. Push subscriptions set updated_at trigger
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function private.set_updated_at();

-- 4. Update item audit trigger to record both timestamp AND acting user on INSERT
drop trigger if exists trigger_update_last_modified on public.items;

create or replace function public.update_last_modified() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.last_modified_at = now();
  new.last_modified_by = auth.uid();
  return new;
end;
$$;
revoke all on function public.update_last_modified() from public, anon, authenticated;

create trigger trigger_update_last_modified before insert or update on public.items
for each row execute function public.update_last_modified();

-- 5. Fix realtime publication membership to match canonical definitions
-- Add categories and items (inventory tables that should be published)
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

-- Ensure non-inventory tables are NOT published (they should already be absent, but verify)
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

-- 6. Ensure full replica identity for realtime inventory tables
alter table public.categories replica identity full;
alter table public.items replica identity full;

-- 7. Fix pre-existing permission drift
-- 7a. Revoke PUBLIC execute on create_household_invitation (was incorrectly granted)
revoke all on function public.create_household_invitation(uuid, interval) from public;
revoke all on function public.create_household_invitation(uuid, interval) from anon;
grant execute on function public.create_household_invitation(uuid, interval) to authenticated;

-- 7b. Revoke forbidden direct table grants to authenticated role
revoke all on table public.household_invitations from authenticated;
revoke all on table public.household_members from authenticated;
revoke all on table public.households from authenticated;

-- 7c. Fix items column grants (were too permissive)
revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit_id, low_stock_threshold) on table public.items to authenticated;
grant update (name, category_id, unit_id, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

-- 7d. Fix categories column grants (id and created_at were writable)
revoke all on table public.categories from authenticated;
grant select on table public.categories to authenticated;
grant insert (household_id, name, icon, "order") on table public.categories to authenticated;
grant update (name, icon, "order") on table public.categories to authenticated;
grant delete on table public.categories to authenticated;

-- 7e. Fix push_subscriptions column grants (id and timestamps were writable)
revoke all on table public.push_subscriptions from authenticated;
grant select on table public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, subscription) on table public.push_subscriptions to authenticated;
grant update (endpoint, subscription) on table public.push_subscriptions to authenticated;
grant delete on table public.push_subscriptions to authenticated;

-- 7f. Fix profiles column grants (id and timestamps were writable)
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- 7g. Fix households column grants (id and created_at were writable)
revoke all on table public.households from authenticated;
grant select on table public.households to authenticated;
grant update (name) on table public.households to authenticated;
