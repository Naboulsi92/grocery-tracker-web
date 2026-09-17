-- V1.1 Schema Migration
-- Creates default catalog tables, category_positions, history,
-- modifies existing tables, migrates data, updates functions/triggers/RLS/grants.

-- ══════════════════════════════════════════════════════════════
-- 1. Create new tables
-- ══════════════════════════════════════════════════════════════

create table public.default_categories (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  "position" int not null
);

create table public.default_items (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  default_category_id uuid not null references public.default_categories(id) on delete cascade,
  unit text not null default 'unite',
  "threshold" int not null default 1
);

create table public.category_positions (
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  "position" int not null,
  primary key (household_id, category_id)
);

create index category_positions_household_id_idx on public.category_positions (household_id);

create table public.history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  performed_by uuid references auth.users(id) on delete set null,
  action_type text not null check (action_type in ('modification', 'suppression')),
  item_name text not null,
  performed_at timestamptz not null default now()
);

alter table public.history enable row level security;

-- ══════════════════════════════════════════════════════════════
-- 2. Modify categories table
-- ══════════════════════════════════════════════════════════════

alter table public.categories add column is_default boolean not null default false;

-- ══════════════════════════════════════════════════════════════
-- 3. Migrate category_positions from "order" column
-- ══════════════════════════════════════════════════════════════

insert into public.category_positions (household_id, category_id, "position")
select household_id, id, coalesce("order", 0) from public.categories;

-- ══════════════════════════════════════════════════════════════
-- 4. Drop old category columns
-- ══════════════════════════════════════════════════════════════

alter table public.categories drop column icon;
alter table public.categories drop column "order";

-- ══════════════════════════════════════════════════════════════
-- 5. Modify items table: add new columns
-- ══════════════════════════════════════════════════════════════

alter table public.items add column unit text;
alter table public.items add column already_notified boolean not null default false;
alter table public.items add column updated_at timestamptz not null default now();

-- ══════════════════════════════════════════════════════════════
-- 6. Migrate items: unit_id → unit text
-- ══════════════════════════════════════════════════════════════

update public.items i
set unit = case u.name
  when 'Unité' then 'unite'
  when 'Kilogramme' then 'kg'
  when 'Gramme' then 'g'
  when 'Litre' then 'l'
  when 'Millilitre' then 'ml'
  when 'Pack' then 'unite'
  when 'Boîte' then 'unite'
  else 'unite'
end
from public.units u
where i.unit_id = u.id;

update public.items set unit = 'unite' where unit is null;

alter table public.items alter column unit set not null;
alter table public.items alter column unit set default 'unite';

-- ══════════════════════════════════════════════════════════════
-- 7. Modify items table: drop old FK/column, restore FK with restrict
-- ══════════════════════════════════════════════════════════════

drop index if exists public.items_unit_id_idx;
alter table public.items drop constraint items_category_household_fkey;
alter table public.items drop column unit_id;

-- Restore composite FK with ON DELETE RESTRICT (category deletion blocked while items exist)
alter table public.items add constraint items_category_household_fkey
  foreign key (category_id, household_id)
  references public.categories (id, household_id)
  on delete restrict;

create index if not exists items_household_id_idx on public.items (household_id);
create index if not exists items_category_id_idx on public.items (category_id);

-- Case-insensitive unique item name within household
create unique index items_household_name_unique_idx
  on public.items (household_id, lower(name));

-- ══════════════════════════════════════════════════════════════
-- 8. Drop units table
-- ══════════════════════════════════════════════════════════════

drop policy if exists "Authenticated users can view units" on public.units;
drop policy if exists units_select_authenticated on public.units;
revoke all on public.units from authenticated;
drop table public.units;

-- ══════════════════════════════════════════════════════════════
-- 9. Modify profiles table
-- ══════════════════════════════════════════════════════════════

alter table public.profiles
  add column notification_type text check (notification_type in ('push', 'badge', 'both')),
  add column reminder_time time,
  add column language text not null default 'fr' check (language in ('fr', 'en')),
  add column deleted_at timestamptz;

-- ══════════════════════════════════════════════════════════════
-- 10. Add indexes and constraints
-- ══════════════════════════════════════════════════════════════

-- Case-insensitive unique custom category name within household
create unique index categories_household_name_unique_idx
  on public.categories (household_id, lower(name))
  where is_default = false;

-- ══════════════════════════════════════════════════════════════
-- 11. Seed default catalog data
-- ══════════════════════════════════════════════════════════════

insert into public.default_categories (name_fr, name_en, "position") values
  ('Légumes', 'Vegetables', 1),
  ('Fruits', 'Fruits', 2),
  ('Produits laitiers', 'Dairy', 3),
  ('Féculents', 'Grains', 4),
  ('Viandes', 'Meat', 5),
  ('Poissons', 'Fish', 6),
  ('Épicerie', 'Grocery', 7),
  ('Boissons', 'Beverages', 8),
  ('Hygiène', 'Hygiene', 9),
  ('Entretien', 'Cleaning', 10);

insert into public.default_items (name_fr, name_en, default_category_id, unit, "threshold") values
  ('Lait', 'Milk',
    (select id from public.default_categories where name_fr = 'Produits laitiers'), 'l', 1),
  ('Pain', 'Bread',
    (select id from public.default_categories where name_fr = 'Féculents'), 'unite', 1),
  ('Œufs', 'Eggs',
    (select id from public.default_categories where name_fr = 'Produits laitiers'), 'unite', 1),
  ('Beurre', 'Butter',
    (select id from public.default_categories where name_fr = 'Produits laitiers'), 'unite', 1),
  ('Fromage', 'Cheese',
    (select id from public.default_categories where name_fr = 'Produits laitiers'), 'unite', 1),
  ('Yaourt', 'Yogurt',
    (select id from public.default_categories where name_fr = 'Produits laitiers'), 'unite', 1),
  ('Poulet', 'Chicken',
    (select id from public.default_categories where name_fr = 'Viandes'), 'kg', 1),
  ('Riz', 'Rice',
    (select id from public.default_categories where name_fr = 'Féculents'), 'kg', 1),
  ('Pâtes', 'Pasta',
    (select id from public.default_categories where name_fr = 'Féculents'), 'kg', 1),
  ('Huile', 'Oil',
    (select id from public.default_categories where name_fr = 'Épicerie'), 'l', 1);

-- ══════════════════════════════════════════════════════════════
-- 12. RLS for new tables
-- ══════════════════════════════════════════════════════════════

alter table public.default_categories enable row level security;
alter table public.default_items enable row level security;
alter table public.category_positions enable row level security;

-- Default catalog: readable by all authenticated
create policy default_categories_select_authenticated on public.default_categories
  for select to authenticated using (true);

create policy default_items_select_authenticated on public.default_items
  for select to authenticated using (true);

-- History: members only
create policy history_select_member on public.history for select to authenticated
  using (private.is_household_member(household_id));
create policy history_insert_member on public.history for insert to authenticated
  with check (private.is_household_member(household_id));
create policy history_delete_member on public.history for delete to authenticated
  using (private.is_household_member(household_id));

-- Category positions: members only
create policy category_positions_select_member on public.category_positions for select to authenticated
  using (private.is_household_member(household_id));
create policy category_positions_insert_member on public.category_positions for insert to authenticated
  with check (private.is_household_member(household_id));
create policy category_positions_update_member on public.category_positions for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
create policy category_positions_delete_member on public.category_positions for delete to authenticated
  using (private.is_household_member(household_id));

-- ══════════════════════════════════════════════════════════════
-- 13. Update grants
-- ══════════════════════════════════════════════════════════════

-- Categories: update insert/update grants (remove icon, "order"; add is_default)
revoke all on table public.categories from authenticated;
grant select on table public.categories to authenticated;
grant insert (household_id, name, is_default) on table public.categories to authenticated;
grant update (name, is_default) on table public.categories to authenticated;
grant delete on table public.categories to authenticated;

-- Items: update insert/update grants (replace unit_id with unit)
revoke all on table public.items from authenticated;
grant select on table public.items to authenticated;
grant insert (household_id, category_id, name, quantity, unit, low_stock_threshold) on table public.items to authenticated;
grant update (name, category_id, unit, low_stock_threshold) on table public.items to authenticated;
grant delete on table public.items to authenticated;

-- Default catalog: read-only for authenticated
grant select on public.default_categories to authenticated;
grant select on public.default_items to authenticated;

-- ══════════════════════════════════════════════════════════════
-- 14. Update create_household function
-- ══════════════════════════════════════════════════════════════

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_household_id uuid;
  default_cat_row record;
  default_item_row record;
  category_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into new_household_id;
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, actor, 'owner');

  for default_cat_row in
    select dc.id, dc.name_fr, dc."position"
    from public.default_categories dc
    order by dc."position"
  loop
    insert into public.categories (household_id, name, is_default)
    values (new_household_id, default_cat_row.name_fr, true)
    returning id into category_id;

    insert into public.category_positions (household_id, category_id, "position")
    values (new_household_id, category_id, default_cat_row."position");
  end loop;

  for default_item_row in
    select di.name_fr, c.id as category_id, di.unit, di."threshold"
    from public.default_items di
    join public.categories c
      on c.household_id = new_household_id
      and c.name = (
        select dc.name_fr from public.default_categories dc where dc.id = di.default_category_id
      )
      and c.is_default = true
  loop
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold, already_notified)
    values (new_household_id, default_item_row.category_id, default_item_row.name_fr, 0, default_item_row.unit, default_item_row."threshold", true);
  end loop;

  return new_household_id;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 15. Update create_household_invitation function
-- ══════════════════════════════════════════════════════════════

create or replace function public.create_household_invitation(
  p_household_id uuid,
  p_expires_in interval default interval '24 hours'
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  raw_token text;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  i int;
  v int;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not private.is_household_member(p_household_id) then raise exception 'household member required' using errcode = '42501'; end if;
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days' then
    raise exception 'invitation lifetime must be between 0 and 30 days' using errcode = '22023';
  end if;

  -- Retire any existing live invitation for this household
  update public.household_invitations
  set revoked_at = now()
  where household_id = p_household_id
    and revoked_at is null
    and consumed_at is null
    and household_invitations.expires_at > now();

  -- Generate an 8-char alphanumeric token via the CSPRNG gen_random_bytes(),
  -- with rejection sampling over the 62-symbol alphabet: draw one byte per
  -- char, accept only values below 62*4 = 248, then reduce mod 62 for a
  -- uniform, unbiased mapping (no modulo bias).
  raw_token := '';
  for i in 1..8 loop
    loop
      v := get_byte(gen_random_bytes(1), 0);
      exit when v < length(chars) * 4;
    end loop;
    raw_token := raw_token || substr(chars, (v % length(chars)) + 1, 1);
  end loop;

  return query
  insert into public.household_invitations (household_id, token_hash, created_by, expires_at)
  values (p_household_id, sha256(convert_to(raw_token, 'UTF8')), actor, now() + p_expires_in)
  returning id, raw_token, household_invitations.expires_at;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 16. Update item audit trigger
-- ══════════════════════════════════════════════════════════════

create or replace function public.update_last_modified() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.last_modified_at = now();
  new.last_modified_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_update_last_modified on public.items;
create trigger trigger_update_last_modified before insert or update on public.items
for each row execute function public.update_last_modified();

-- ══════════════════════════════════════════════════════════════
-- 17. History cap trigger (max 20 per household)
-- ══════════════════════════════════════════════════════════════

create or replace function public.cap_history() returns trigger
language plpgsql set search_path = ''
as $$
begin
  delete from public.history
  where household_id = NEW.household_id
    and id not in (
      select id from public.history
      where household_id = NEW.household_id
      order by performed_at desc
      limit 19
    );
  return NEW;
end;
$$;

create trigger history_cap_trigger after insert on public.history
for each row execute function public.cap_history();

-- ══════════════════════════════════════════════════════════════
-- 18. Household member limit trigger (max 2)
-- ══════════════════════════════════════════════════════════════

create or replace function public.check_household_member_limit() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.household_members where household_id = NEW.household_id) >= 2 then
    raise exception 'household is full' using errcode = '23505';
  end if;
  return NEW;
end;
$$;

create trigger household_member_limit before insert on public.household_members
for each row execute function public.check_household_member_limit();

-- ══════════════════════════════════════════════════════════════
-- 19. Household orphan cleanup trigger
-- ══════════════════════════════════════════════════════════════

create or replace function public.cleanup_empty_household() returns trigger
language plpgsql set search_path = ''
as $$
declare
  remaining_count int;
begin
  select count(*) into remaining_count
  from public.household_members
  where household_id = OLD.household_id;

  if remaining_count = 0 then
    -- Items first (ON DELETE RESTRICT on the composite category FK would block
    -- category removal); categories cascade into category_positions
    delete from public.items where household_id = OLD.household_id;
    delete from public.categories where household_id = OLD.household_id;
    -- Cascade removes invitations, history, category_positions, profiles leftovers
    delete from public.households where id = OLD.household_id;
  end if;

  return OLD;
end;
$$;

create trigger household_orphan_cleanup after delete on public.household_members
for each row execute function public.cleanup_empty_household();

-- ══════════════════════════════════════════════════════════════
-- 20. Revoke private/trigger functions from client roles
-- ══════════════════════════════════════════════════════════════

revoke all on function public.update_last_modified() from public, anon, authenticated;
revoke all on function public.cap_history() from public, anon, authenticated;
revoke all on function public.check_household_member_limit() from public, anon, authenticated;
revoke all on function public.cleanup_empty_household() from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 21. Equal-rights invitations: revoke_household_invitation
-- ══════════════════════════════════════════════════════════════
-- Any household member (not just the owner) may manage invitations.
-- Overrides the owner-only guard from the secure house model migration.
-- CREATE OR REPLACE preserves the existing EXECUTE grant to authenticated.

create or replace function public.revoke_household_invitation(p_invitation_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.household_invitations i set revoked_at = now()
  where i.id = p_invitation_id and i.revoked_at is null and i.consumed_at is null
    and private.is_household_member(i.household_id);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 22. Server-enforced invite try lockout
-- ══════════════════════════════════════════════════════════════
-- A known-but-invalid token (revoked, consumed, expired) counts toward a
-- per-invitation brute-force counter. After 5 failed attempts the invitation
-- is blocked for 1 minute (blocked_until). consume_household_invitation
-- enforces the block server-side.

alter table public.household_invitations
  add column failed_attempts int not null default 0,
  add column blocked_until timestamptz;

create or replace function public.consume_household_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.household_invitations%rowtype;
  v_now timestamptz := now();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = actor) then
    raise exception 'user already belongs to a household' using errcode = '23505';
  end if;

  select * into invitation from public.household_invitations
  where token_hash = sha256(convert_to(btrim(p_token), 'UTF8')) for update;

  -- Unknown token: nothing to increment, stays a plain invalid-token error
  if not found then
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;

  -- Server-side lockout: previously blocked via failed_attempts
  if invitation.blocked_until is not null and invitation.blocked_until > v_now then
    raise exception 'invitation is temporarily locked' using errcode = 'P0001';
  end if;

  -- Known but invalid token: count the attempt, block after 5
  if invitation.revoked_at is not null or invitation.consumed_at is not null or invitation.expires_at <= v_now then
    update public.household_invitations
    set failed_attempts = failed_attempts + 1,
        blocked_until = case
          when failed_attempts + 1 >= 5 then v_now + interval '1 minute'
          else blocked_until
        end
    where id = invitation.id;
    raise exception 'invitation is invalid or unavailable' using errcode = '22023';
  end if;

  -- Valid live invitation: consume and reset the try counter
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, actor, 'member');
  update public.household_invitations
  set consumed_at = v_now, consumed_by = actor,
      failed_attempts = 0, blocked_until = null
  where id = invitation.id;
  return invitation.household_id;
end;
$$;

-- NOTE: token whitespace is stripped here via btrim() to mirror the client's
-- normalizeInvitationToken() trimming (US 16 — whitespace-tolerant join).