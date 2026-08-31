create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.household_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 80)
);

alter table public.household_members
  add column role public.household_role not null default 'member';

do $$
declare
  orphan_count bigint;
  orphan_sample text;
begin
  select count(*) into orphan_count
  from public.households h
  where not exists (
    select 1 from public.household_members hm where hm.household_id = h.id
  );

  select string_agg(id::text, ', ' order by id) into orphan_sample
  from (
    select h.id
    from public.households h
    where not exists (
      select 1 from public.household_members hm where hm.household_id = h.id
    )
    order by h.id
    limit 20
  ) orphan_households;

  if orphan_count > 0 then
    raise exception 'cannot assign household owners: % historical household(s) have no members (sample ids: %)',
      orphan_count, orphan_sample
      using errcode = '23514',
        hint = 'Add at least one household_members row for every listed household, then rerun the migration.';
  end if;

  if exists (
    select 1
    from public.household_members
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'cannot enforce single-household membership: historical users belong to multiple households'
      using errcode = '23505';
  end if;
end;
$$;

alter table public.household_members
  add constraint household_members_user_id_key unique (user_id);

with ranked_members as (
  select household_id, user_id,
    row_number() over (partition by household_id order by joined_at nulls last, user_id) as position
  from public.household_members
)
update public.household_members hm
set role = 'owner'
from ranked_members rm
where hm.household_id = rm.household_id and hm.user_id = rm.user_id and rm.position = 1;

create unique index household_one_owner_idx
  on public.household_members (household_id) where role = 'owner';

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete set null,
  constraint household_invitations_expiry check (expires_at > created_at),
  constraint household_invitations_consumption check (
    (consumed_at is null and consumed_by is null) or
    (consumed_at is not null and consumed_by is not null)
  )
);

alter table public.push_subscriptions add column endpoint text;
update public.push_subscriptions
set endpoint = coalesce(nullif(subscription ->> 'endpoint', ''), 'legacy:' || id::text);
alter table public.push_subscriptions alter column endpoint set not null;
alter table public.push_subscriptions drop constraint push_subscriptions_user_id_key;
alter table public.push_subscriptions add constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint);
alter table public.push_subscriptions add column updated_at timestamptz not null default now();

alter table public.items add constraint items_quantity_nonnegative check (quantity >= 0) not valid;
update public.items set quantity = 0 where quantity < 0;
alter table public.items validate constraint items_quantity_nonnegative;

do $$
begin
  if exists (
    select 1
    from public.items i
    join public.categories c on c.id = i.category_id
    where c.household_id <> i.household_id
  ) then
    raise exception 'cannot enforce category isolation: historical items reference another household category'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.categories add constraint categories_id_household_id_key unique (id, household_id);
alter table public.items drop constraint items_category_id_fkey;
alter table public.items add constraint items_category_household_fkey
  foreign key (category_id, household_id)
  references public.categories (id, household_id)
  on delete set null (category_id);

insert into public.profiles (id, display_name, created_at, updated_at)
select id,
  nullif(left(btrim(coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name')), 80), ''),
  coalesce(created_at, now()), now()
from auth.users
on conflict (id) do nothing;

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

create function private.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create function private.is_household_owner(target_household_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid() and role = 'owner'
  );
$$;

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

revoke all on function private.is_household_member(uuid) from public, anon, authenticated;
revoke all on function private.is_household_owner(uuid) from public, anon, authenticated;
revoke all on function private.can_view_profile(uuid) from public, anon, authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

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
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function private.set_updated_at();

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
drop trigger if exists trigger_update_last_modified on public.items;
create trigger trigger_update_last_modified before insert or update on public.items
for each row execute function public.update_last_modified();

drop policy if exists "Users can view their own households" on public.households;
drop policy if exists "Users can insert households they belong to" on public.households;
drop policy if exists "Users can view their own membership" on public.household_members;
drop policy if exists "Users can join households" on public.household_members;
drop policy if exists "Users can view categories in their households" on public.categories;
drop policy if exists "Users can manage categories in their households" on public.categories;
drop policy if exists "Users can view items in their households" on public.items;
drop policy if exists "Users can manage items in their households" on public.items;
drop policy if exists "Authenticated users can view units" on public.units;
drop policy if exists "Users can manage their own push subscriptions" on public.push_subscriptions;

alter table public.profiles enable row level security;
alter table public.household_invitations enable row level security;

create policy households_select_member on public.households for select to authenticated
using (private.is_household_member(id));
create policy households_update_owner on public.households for update to authenticated
using (private.is_household_owner(id))
with check (private.is_household_owner(id));

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

create policy units_select_authenticated on public.units for select to authenticated using (true);
create policy push_subscriptions_select_self on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_self on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()) and endpoint = subscription ->> 'endpoint');
create policy push_subscriptions_update_self on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and endpoint = subscription ->> 'endpoint');
create policy push_subscriptions_delete_self on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.households, public.household_members, public.categories, public.items,
  public.units, public.profiles, public.household_invitations, public.push_subscriptions from anon;
revoke all on public.households, public.household_members, public.categories, public.items,
  public.units, public.profiles, public.household_invitations, public.push_subscriptions from authenticated;
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, delete on public.categories to authenticated;
grant insert (household_id, name, icon, "order") on public.categories to authenticated;
grant update (name, icon, "order") on public.categories to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, subscription) on public.push_subscriptions to authenticated;
grant update (endpoint, subscription) on public.push_subscriptions to authenticated;
grant select, delete on public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit_id, low_stock_threshold) on public.items to authenticated;
grant update (name, category_id, unit_id, low_stock_threshold) on public.items to authenticated;
grant select on public.units to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_household_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, actor, 'owner');
  insert into public.categories (household_id, name, icon, "order") values
    (new_household_id, 'Fruits & Légumes', '🥦', 1),
    (new_household_id, 'Produits laitiers', '🥛', 2),
    (new_household_id, 'Pain & Pâtisserie', '🥖', 3),
    (new_household_id, 'Viande & Poisson', '🍖', 4),
    (new_household_id, 'Épicerie', '🥫', 5),
    (new_household_id, 'Hygiène & Entretien', '🧼', 6);
  return new_household_id;
end;
$$;

create function public.create_household_invitation(
  p_household_id uuid,
  p_expires_in interval default interval '7 days'
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  raw_token text;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_household_owner(p_household_id) then raise exception 'household owner required' using errcode = '42501'; end if;
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days' then
    raise exception 'invitation lifetime must be between 0 and 30 days' using errcode = '22023';
  end if;

  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  return query
  insert into public.household_invitations (household_id, token_hash, created_by, expires_at)
  values (p_household_id, sha256(convert_to(raw_token, 'UTF8')), actor, now() + p_expires_in)
  returning id, raw_token, household_invitations.expires_at;
end;
$$;

create function public.revoke_household_invitation(p_invitation_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.household_invitations i set revoked_at = now()
  where i.id = p_invitation_id and i.revoked_at is null and i.consumed_at is null
    and private.is_household_owner(i.household_id);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create function public.consume_household_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.household_invitations%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;
  select * into invitation from public.household_invitations
  where token_hash = sha256(convert_to(p_token, 'UTF8')) for update;
  if not found or invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= now() then
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, actor, 'member');
  update public.household_invitations set consumed_at = now(), consumed_by = actor where id = invitation.id;
  return invitation.household_id;
end;
$$;

create function public.adjust_item_quantity(p_item_id uuid, p_delta numeric) returns public.items
language plpgsql security definer set search_path = ''
as $$
declare updated_item public.items;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_delta is null then raise exception 'quantity delta is required' using errcode = '22023'; end if;
  update public.items
  set quantity = greatest(0, quantity + p_delta)
  where id = p_item_id and private.is_household_member(household_id)
  returning * into updated_item;
  if not found then raise exception 'item not found or inaccessible' using errcode = 'P0002'; end if;
  return updated_item;
end;
$$;

revoke all on function public.create_household(text) from public, anon, authenticated;
revoke all on function public.create_household_invitation(uuid, interval) from public, anon, authenticated;
revoke all on function public.revoke_household_invitation(uuid) from public, anon, authenticated;
revoke all on function public.consume_household_invitation(text) from public, anon, authenticated;
revoke all on function public.adjust_item_quantity(uuid, numeric) from public, anon, authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation(uuid, interval) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
grant execute on function public.consume_household_invitation(text) to authenticated;
grant execute on function public.adjust_item_quantity(uuid, numeric) to authenticated;

create index categories_household_id_idx on public.categories (household_id);
create index items_household_id_idx on public.items (household_id);
create index items_category_id_idx on public.items (category_id);
create index items_unit_id_idx on public.items (unit_id);
create index items_last_modified_by_idx on public.items (last_modified_by);
create index household_invitations_household_id_idx on public.household_invitations (household_id);
create index household_invitations_active_idx on public.household_invitations (household_id, expires_at)
  where revoked_at is null and consumed_at is null;
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.categories replica identity full;
alter table public.items replica identity full;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['categories', 'items'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;

  foreach realtime_table in array array[
    'households', 'household_members', 'profiles', 'household_invitations',
    'push_subscriptions', 'units'
  ] loop
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', realtime_table);
    end if;
  end loop;
end;
$$;
