\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'single@example.test', '', now(), now());

do $$
begin
  -- Realtime publication must be EXACTLY {categories, items}: inventory tables
  -- present, every other public table (incl. units/history) absent.
  if (select coalesce(array_agg(tablename::text order by tablename::text), '{}'::text[])
      from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public')
     <> array['categories', 'items']::text[] then
    raise exception 'Realtime publication must be exactly {categories, items}';
  end if;
  if exists (
    select 1 from pg_class
    where oid in ('public.categories'::regclass, 'public.items'::regclass)
      and relreplident <> 'f'
  ) then
    raise exception 'Realtime inventory tables must use full replica identity';
  end if;
  if (select count(*) from public.profiles where id::text like '00000000-0000-4000-8000-00000000000%') <> 4 then
    raise exception 'signup must create profiles';
  end if;
  if exists (select 1 from public.household_members where user_id::text like '00000000-0000-4000-8000-00000000000%') then
    raise exception 'signup must not create implicit households';
  end if;
end;
$$;

-- Ticket #106 iteration 2, condition 1 (preuve convergence): no PUBLIC surface.
-- Zero policies targeting the PUBLIC role, zero policies targeting anon, zero
-- bare WITH CHECK (true), and zero table grants (SELECT/INSERT/UPDATE/DELETE)
-- for anon AND for the PUBLIC pseudo-role on every public table (migration
-- REVOKE ALL FROM PUBLIC). Function EXECUTE anon=false / public=false is
-- asserted in the RPC grant loop below. Anon perimeter: the pg_policies
-- 'anon' = ANY(roles) assert is the symmetric pendant of the PUBLIC one —
-- canonical policies are all TO authenticated, so any anon-targeted policy
-- (legacy or divergent prod) fails here and is purged by the migration loop.
do $$
declare
  convergence_table text;
  convergence_priv text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and 'public' = any (roles)
  ) then
    raise exception 'a policy still targets PUBLIC (expected TO authenticated only)';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and 'anon' = any (roles)
  ) then
    raise exception 'a policy still targets anon (expected TO authenticated only)';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and with_check = 'true'
  ) then
    raise exception 'a policy still carries WITH CHECK (true)';
  end if;
  foreach convergence_table in array array[
    'households', 'household_members', 'categories', 'items', 'profiles',
    'household_invitations', 'push_subscriptions', 'history',
    'category_positions', 'default_categories', 'item_templates',
    'pending_notifications', 'units'
  ] loop
    foreach convergence_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege('anon', 'public.' || convergence_table, convergence_priv) then
        raise exception 'anon keeps % on public.%', convergence_priv, convergence_table;
      end if;
      if has_table_privilege('public', 'public.' || convergence_table, convergence_priv) then
        raise exception 'public keeps % on public.%', convergence_priv, convergence_table;
      end if;
    end loop;
  end loop;
end;
$$;

-- Ticket #106 (PRD v1.4 §5): household_invitations is function-only
-- (consume/revoke/get RPCs). Zero direct policies; RLS stays enabled with no
-- grants, so any direct SELECT raises insufficient_privilege.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'household_invitations'
  ) then
    raise exception 'household_invitations must have zero policies (function-only)';
  end if;
end;
$$;

do $$
declare
  function_signature text;
  helper_denied boolean := false;
begin
  foreach function_signature in array array[
    'public.create_household(text)',
    'public.create_household_invitation(uuid,interval)',
    'public.revoke_household_invitation(uuid)',
    'public.consume_household_invitation(text)',
    'public.get_household_invitation(uuid)',
    'public.adjust_item_quantity(uuid,numeric)'
  ] loop
    if has_function_privilege('anon', function_signature, 'EXECUTE') then
      raise exception 'anon can execute %', function_signature;
    end if;
    if has_function_privilege('public', function_signature, 'EXECUTE') then
      raise exception 'public can execute %', function_signature;
    end if;
    if not has_function_privilege('authenticated', function_signature, 'EXECUTE') then
      raise exception 'authenticated cannot execute %', function_signature;
    end if;
  end loop;

  if has_function_privilege('authenticated', 'private.handle_new_user()', 'EXECUTE')
    or has_function_privilege('authenticated', 'private.set_updated_at()', 'EXECUTE')
    or has_function_privilege('authenticated', 'private.normalize_profile_display_name()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.update_last_modified()', 'EXECUTE') then
    raise exception 'trigger function is client-executable';
  end if;
  if has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'authenticated can resolve private RLS helpers directly';
  end if;
  if to_regprocedure('private.is_household_member(uuid,uuid)') is not null
    or to_regprocedure('private.is_household_owner(uuid,uuid)') is not null
    or to_regprocedure('private.shares_household(uuid,uuid)') is not null then
    raise exception 'private RLS helper accepts arbitrary user identities';
  end if;
  begin
    begin
      execute 'set local role authenticated';
      execute 'select private.is_household_member(''00000000-0000-4000-8000-000000000000'')';
    exception when sqlstate '42501' then
      helper_denied := true;
    end;
    reset role;
    if not helper_denied then
      raise exception 'authenticated directly executed a private RLS helper';
    end if;
  end;
  if has_table_privilege('authenticated', 'public.household_invitations', 'SELECT')
    or has_table_privilege('authenticated', 'public.household_members', 'INSERT')
    or has_table_privilege('authenticated', 'public.households', 'INSERT') then
    raise exception 'authenticated has a forbidden direct table grant';
  end if;
  if has_column_privilege('authenticated', 'public.items', 'quantity', 'UPDATE')
    or has_column_privilege('authenticated', 'public.items', 'household_id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.items', 'last_modified_by', 'UPDATE')
    or has_column_privilege('authenticated', 'public.items', 'last_modified_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.items', 'id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.items', 'last_modified_by', 'INSERT')
    or has_column_privilege('authenticated', 'public.items', 'last_modified_at', 'INSERT')
    or has_column_privilege('authenticated', 'public.items', 'created_at', 'INSERT')
    or has_column_privilege('authenticated', 'public.items', 'id', 'INSERT')
    or not has_column_privilege('authenticated', 'public.items', 'name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.items', 'quantity', 'INSERT')
    or not has_column_privilege('authenticated', 'public.items', 'template_id', 'INSERT')
    or not has_column_privilege('authenticated', 'public.items', 'low_stock_threshold', 'UPDATE') then
    raise exception 'authenticated item column grants violate the write contract';
  end if;
  if has_column_privilege('authenticated', 'public.categories', 'id', 'INSERT')
    or has_column_privilege('authenticated', 'public.categories', 'id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.categories', 'created_at', 'INSERT')
    or has_column_privilege('authenticated', 'public.categories', 'created_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.push_subscriptions', 'id', 'INSERT')
    or has_column_privilege('authenticated', 'public.push_subscriptions', 'id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.push_subscriptions', 'created_at', 'INSERT')
    or has_column_privilege('authenticated', 'public.push_subscriptions', 'created_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.push_subscriptions', 'updated_at', 'INSERT')
    or has_column_privilege('authenticated', 'public.push_subscriptions', 'updated_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.households', 'id', 'UPDATE')
    or has_column_privilege('authenticated', 'public.households', 'created_at', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.categories', 'name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.push_subscriptions', 'subscription', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'last_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'notification_type', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'reminder_time', 'UPDATE') then
    raise exception 'authenticated can write generated identifiers or timestamps';
  end if;
end;
$$;

-- Debate C2: profiles.notification_type must default to 'push', be NOT NULL,
-- and its CHECK must keep covering every allowed value.
do $$
begin
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'notification_type') is distinct from '''push''::text' then
    raise exception 'profiles.notification_type default must be "push"';
  end if;
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'notification_type') <> 'NO' then
    raise exception 'profiles.notification_type must be NOT NULL';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~ 'notification_type'
      and pg_get_constraintdef(c.oid) ~ 'push'
      and pg_get_constraintdef(c.oid) ~ 'badge'
      and pg_get_constraintdef(c.oid) ~ 'both'
      and pg_get_constraintdef(c.oid) ~ 'none'
  ) then
    raise exception 'profiles.notification_type CHECK must cover push, badge, both, none';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.create_household('Test household') as household_id \gset
reset role;
select set_config('test.household_id', :'household_id', true);
do $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = current_setting('test.household_id')::uuid
      and user_id = '00000000-0000-4000-8000-000000000001'
      and role = 'owner'
  ) then raise exception 'household creator must be owner'; end if;
  if (select count(*) from public.categories where household_id = current_setting('test.household_id')::uuid) <> 10 then
    raise exception 'household defaults must be complete';
  end if;
end;
$$;

set local role authenticated;
do $$
declare denied boolean := false;
begin
  begin
    insert into public.household_members (household_id, user_id, role)
    values (current_setting('test.household_id')::uuid, '00000000-0000-4000-8000-000000000003', 'member');
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'direct membership insert unexpectedly succeeded'; end if;
end;
$$;
reset role;

-- Create first invitation
select * from public.create_household_invitation(:'household_id'::uuid, interval '1 day') \gset invite_

-- Create second invitation (retires the first)
select * from public.create_household_invitation(:'household_id'::uuid, interval '1 day') \gset revoked_

-- Verify first invitation was retired (revoked)
select revoked_at is not null as invite_retired from public.household_invitations where id = :'invite_invitation_id'::uuid \gset

-- Revoke the second invitation (which is currently live)
select public.revoke_household_invitation(:'revoked_invitation_id'::uuid) as revoked_ok \gset

-- Verify second invitation was revoked
select revoked_at is not null as revoked_revoked from public.household_invitations where id = :'revoked_invitation_id'::uuid \gset

-- Revoking an already-revoked invitation is a no-op
select public.revoke_household_invitation(:'revoked_invitation_id'::uuid) as revoke_inactive_ok \gset

-- Create third invitation (becomes the single live invitation)
select * from public.create_household_invitation(:'household_id'::uuid, interval '1 day') \gset occupied_

-- Verify third invitation is still live
select revoked_at is null and consumed_at is null as occupied_live from public.household_invitations where id = :'occupied_invitation_id'::uuid \gset

reset role;

-- Insert manually created test invitations (expired, etc.)
insert into public.household_invitations (
  household_id, token_hash, created_by, created_at, expires_at
) values (
  :'household_id',
  sha256(convert_to('expired-test-token', 'UTF8')),
  '00000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  now() - interval '1 day'
);

select set_config('test.invite_token', :'invite_token', true);
select set_config('test.revoked_token', :'revoked_token', true);
select set_config('test.occupied_token', :'occupied_token', true);
select set_config('test.expired_token', 'expired-test-token', true);
select set_config('test.revoked_ok', :'revoked_ok', true);
select set_config('test.invite_retired', :'invite_retired', true);
select set_config('test.revoked_revoked', :'revoked_revoked', true);
select set_config('test.occupied_live', :'occupied_live', true);
select set_config('test.revoke_inactive_ok', :'revoke_inactive_ok', true);

set local role authenticated;

do $$
begin
  -- v1.1 invites use an 8-char alphanumeric token (62-symbol alphabet ≈ 47.6 bits
  -- entropy), sufficient because expiry (24h default), single-use, and a
  -- 5-attempt/1-minute server-side lockout are enforced. The lockout only mitigates
  -- known-but-invalid tokens; unknown-token enumeration is bounded by keyspace size.
  if length(current_setting('test.invite_token')) <> 8
    or current_setting('test.invite_token') !~ '^[A-Za-z0-9]+$'
  then raise exception 'invitation token must be exactly 8 alphanumeric characters'; end if;
  if not current_setting('test.revoked_ok')::boolean then raise exception 'owner could not revoke invitation'; end if;
  if not current_setting('test.invite_retired')::boolean then raise exception 'first invitation was not retired when second was created'; end if;
  if not current_setting('test.revoked_revoked')::boolean then raise exception 'second invitation was not revoked'; end if;
  if not current_setting('test.occupied_live')::boolean then raise exception 'third invitation is not live'; end if;
  if current_setting('test.revoke_inactive_ok')::boolean then raise exception 'revoking an already-revoked invitation unexpectedly succeeded'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
-- Consume the third (live) invitation
select public.consume_household_invitation(:'occupied_token') as joined_household_id \gset
reset role;
select set_config('test.joined_household_id', :'joined_household_id', true);
set local role authenticated;

do $$
declare default_cat_id uuid; custom_cat_id uuid; forged_insert_denied boolean := false;
begin
  if current_setting('test.household_id')::uuid <> current_setting('test.joined_household_id')::uuid then
    raise exception 'wrong joined household';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = current_setting('test.household_id')::uuid
      and user_id = '00000000-0000-4000-8000-000000000002'
      and role = 'member'
  ) then raise exception 'invitation did not create member'; end if;
  if (select count(*) from public.profiles where id in (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  )) <> 2 then raise exception 'household members cannot read each other profiles'; end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000003') then
    raise exception 'cross-household profile leak';
  end if;
  begin
    perform public.create_household('Second household');
    raise exception 'member created a second household';
  exception when unique_violation then null;
  end;
  begin
    perform public.consume_household_invitation(current_setting('test.occupied_token'));
    raise exception 'member consumed an invitation while already in a household';
  exception when unique_violation then null;
  end;
  -- Equal-rights invites: a member (not only the owner) may create an invitation
  if not exists (
    select 1
    from public.create_household_invitation(current_setting('test.household_id')::uuid, interval '1 day')
  ) then raise exception 'member could not create an invitation'; end if;
  update public.households set name = 'Member rename' where id = current_setting('test.household_id')::uuid;
  if not found then raise exception 'member could not rename household'; end if;
  begin
    perform 1 from public.household_invitations limit 1;
    raise exception 'member unexpectedly read invitation storage';
  exception when insufficient_privilege then null;
  end;
  -- Default categories are immutable for members (PRD §4.3): RLS must hide
  -- is_default = true rows from UPDATE/DELETE, while custom categories remain
  -- fully editable/deletable by any household member.
  select id into default_cat_id
  from public.categories
  where household_id = current_setting('test.household_id')::uuid
    and is_default = true
  limit 1;
  update public.categories set name = 'Forged name' where id = default_cat_id;
  if found then raise exception 'default category name was modifiable'; end if;
  delete from public.categories where id = default_cat_id;
  if found then raise exception 'default category was deletable'; end if;

  insert into public.categories (household_id, name, is_default)
  values (current_setting('test.household_id')::uuid, 'Custom', false)
  returning id into custom_cat_id;
  update public.categories set name = 'Custom renamed' where id = custom_cat_id;
  if not found then raise exception 'member could not rename a custom category'; end if;
  delete from public.categories where id = custom_cat_id;
  if not found then raise exception 'member could not delete a custom category'; end if;
  -- Debate C1: the INSERT policy must not let members forge is_default = true
  -- rows (default categories are reserved for the create_household definer).
  begin
    insert into public.categories (household_id, name, is_default)
    values (current_setting('test.household_id')::uuid, 'Forged default', true);
  exception when insufficient_privilege then forged_insert_denied := true;
  end;
  if not forged_insert_denied then raise exception 'member was allowed to forge a default category'; end if;
  if (select count(*) from public.categories
      where household_id = current_setting('test.household_id')::uuid
        and is_default = true) <> 10 then
    raise exception 'denied default-category forge altered the default set';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.household_members where user_id = '00000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'single-household membership was not enforced';
  end if;
  if exists (
    select 1 from public.household_invitations
    where token_hash = sha256(convert_to(current_setting('test.expired_token'), 'UTF8'))
      and consumed_at is not null
  ) then raise exception 'failed invitation consumption consumed its token'; end if;
end;
$$;

-- Token validation probes as a non-member (single@example.test)
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  -- Iteration 2, condition 4: on a full (2/2) household every KNOWN token
  -- raises 23505 'household is full' with priority over the 22023 validity
  -- errors (PRD §4.2 cap 2). Only unknown tokens (no row) stay 22023.
  begin
    perform public.consume_household_invitation(current_setting('test.invite_token'));
    raise exception 'retired invitation unexpectedly consumed';
  exception when unique_violation then
    if position('household is full' in sqlerrm) = 0 then
      raise exception 'wrong 23505 message for retired invitation on full household: %', sqlerrm;
    end if;
  end;
  begin
    perform public.consume_household_invitation(current_setting('test.revoked_token'));
    raise exception 'revoked invitation unexpectedly consumed';
  exception when unique_violation then
    if position('household is full' in sqlerrm) = 0 then
      raise exception 'wrong 23505 message for revoked invitation on full household: %', sqlerrm;
    end if;
  end;
  begin
    perform public.consume_household_invitation(current_setting('test.expired_token'));
    raise exception 'expired invitation unexpectedly consumed';
  exception when unique_violation then
    if position('household is full' in sqlerrm) = 0 then
      raise exception 'wrong 23505 message for expired invitation on full household: %', sqlerrm;
    end if;
  end;
  begin
    perform public.consume_household_invitation('unknown-token');
    raise exception 'unknown invitation unexpectedly consumed';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

reset role;

-- Iteration 2, condition 3: p_expires_in capped at 24h strict (PRD §4.2/§5).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  begin
    perform public.create_household_invitation(current_setting('test.household_id')::uuid, interval '25 hours');
    raise exception 'invitation beyond 24h unexpectedly created';
  exception when sqlstate '22023' then null;
  end;
  if not exists (
    select 1
    from public.create_household_invitation(current_setting('test.household_id')::uuid, interval '24 hours')
  ) then raise exception 'invitation at exactly 24h was rejected'; end if;
end;
$$;

reset role;

-- Iteration 2, condition 4 (cap 2/2, PRD §4.2 « automatiquement invalides »):
-- self-contained household. 004 creates, 005 joins (2/2 full), 006 attempts a
-- live token (23505 + row auto-consumed), 005 leaves (1/2), the invalidated
-- row stays unusable without regen (22023), a regen lets 006 join.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'capjoiner@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'capoutsider@example.test', '', now(), now());

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.create_household('Cap household') as cap_household_id \gset
select * from public.create_household_invitation(:'cap_household_id'::uuid, interval '1 day') \gset capfill_
reset role;
select set_config('test.cap_token', :'capfill_token', true);
select set_config('test.cap_household_id', :'cap_household_id', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.consume_household_invitation(current_setting('test.cap_token')) as cap_joined_id \gset
reset role;
select set_config('test.cap_joined_id', :'cap_joined_id', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select * from public.create_household_invitation(:'cap_household_id'::uuid, interval '1 day') \gset capfull_
reset role;
select set_config('test.capfull_token', :'capfull_token', true);
select set_config('test.capfull_id', :'capfull_invitation_id', true);

do $$
begin
  if current_setting('test.cap_joined_id')::uuid <> current_setting('test.cap_household_id')::uuid then
    raise exception 'cap fixture did not reach 2/2';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  begin
    perform public.consume_household_invitation(current_setting('test.capfull_token'));
    raise exception 'full-household invitation unexpectedly consumed';
  exception when unique_violation then
    if position('household is full' in sqlerrm) = 0 then
      raise exception 'wrong 23505 message on full household: %', sqlerrm;
    end if;
  end;
end;
$$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.household_invitations
    where id = current_setting('test.capfull_id')::uuid
      and consumed_at is not null
  ) then raise exception 'full-household invitation was not auto-invalidated (consumed)'; end if;
end;
$$;

-- A member leaves (2/2 → 1/2): the invalidated row stays unusable without regen.
delete from public.household_members
where household_id = current_setting('test.cap_household_id')::uuid
  and user_id = '00000000-0000-4000-8000-000000000005';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  begin
    perform public.consume_household_invitation(current_setting('test.capfull_token'));
    raise exception 'invalidated invitation unexpectedly reusable after departure';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select * from public.create_household_invitation(current_setting('test.cap_household_id')::uuid, interval '1 day') \gset capregen_
reset role;
select set_config('test.capregen_token', :'capregen_token', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.consume_household_invitation(current_setting('test.capregen_token')) as cap_rejoined_id \gset
reset role;
select set_config('test.cap_rejoined_id', :'cap_rejoined_id', true);
do $$
begin
  if current_setting('test.cap_rejoined_id')::uuid <> current_setting('test.cap_household_id')::uuid then
    raise exception 'regen invitation did not join the household after departure';
  end if;
end;
$$;

reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
update public.households set name = 'Renamed household' where id = :'household_id' returning name \gset renamed_
reset role;
select set_config('test.renamed_name', :'renamed_name', true);

reset role;
select c.id as item_category_id
from public.categories c
join public.category_positions cp
  on cp.category_id = c.id and cp.household_id = c.household_id
where c.household_id = :'household_id'::uuid
order by cp."position"
limit 1 \gset
select set_config('test.item_category_id', :'item_category_id', true);
insert into public.items (household_id, category_id, name, quantity, unit)
values (:'household_id', :'item_category_id', 'Milk', 1, 'l') returning id as item_id \gset
select set_config('test.item_id', :'item_id', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select quantity, last_modified_by from public.adjust_item_quantity(:'item_id'::uuid, -5) \gset adjusted_
reset role;
select set_config('test.adjusted_quantity', :'adjusted_quantity', true);
select set_config('test.adjusted_user', :'adjusted_last_modified_by', true);
set local role authenticated;

insert into public.items (household_id, category_id, name, quantity, unit)
values (:'household_id', :'item_category_id', 'Bread', 2, 'unite') returning id as inserted_item_id \gset
select set_config('test.inserted_item_id', :'inserted_item_id', true);

update public.profiles
set display_name = repeat(' A ', 50)
where id = '00000000-0000-4000-8000-000000000002';

do $$
begin
  if not exists (
    select 1 from public.items
    where id = current_setting('test.inserted_item_id')::uuid
      and last_modified_by = '00000000-0000-4000-8000-000000000002'
      and last_modified_at is not null
  ) then raise exception 'item insert did not record its authenticated modifier'; end if;
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000002'
      and display_name = left(btrim(repeat(' A ', 50)), 80)
  ) then raise exception 'display name was not trimmed and limited to 80 characters'; end if;
  begin
    update public.items set quantity = 99 where id = current_setting('test.item_id')::uuid;
    raise exception 'direct quantity update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.items set name = 'Updated milk' where id = current_setting('test.item_id')::uuid;
  if not found then raise exception 'allowed item update did not affect a row'; end if;
end;
$$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.items
    where id = current_setting('test.item_id')::uuid
      and name = 'Updated milk'
      and last_modified_by = '00000000-0000-4000-8000-000000000002'
      and last_modified_at is not null
  ) then raise exception 'item update did not record its authenticated modifier'; end if;
end;
$$;
set local role authenticated;

insert into public.push_subscriptions (user_id, endpoint, subscription) values
  ('00000000-0000-4000-8000-000000000002', 'https://push.example.test/a', '{"endpoint":"https://push.example.test/a"}'),
  ('00000000-0000-4000-8000-000000000002', 'https://push.example.test/b', '{"endpoint":"https://push.example.test/b"}');
delete from public.push_subscriptions
where user_id = '00000000-0000-4000-8000-000000000002'
  and endpoint = 'https://push.example.test/a';

do $$
begin
  if current_setting('test.adjusted_quantity')::numeric <> 0 then raise exception 'quantity was not clamped to zero'; end if;
  if current_setting('test.adjusted_user')::uuid <> '00000000-0000-4000-8000-000000000002' then
    raise exception 'last modifier was not recorded';
  end if;
  if current_setting('test.renamed_name') <> 'Renamed household' then raise exception 'owner could not rename household'; end if;
  if (select count(*) from public.push_subscriptions where user_id = '00000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'targeted push endpoint deletion removed the wrong rows';
  end if;
  if not exists (
    select 1 from public.push_subscriptions
    where user_id = '00000000-0000-4000-8000-000000000002'
      and endpoint = 'https://push.example.test/b'
  ) then raise exception 'remaining push endpoint was not retained'; end if;
  begin
    insert into public.push_subscriptions (user_id, endpoint, subscription)
    values (
      '00000000-0000-4000-8000-000000000002',
      'https://push.example.test/mismatch',
      '{"endpoint":"https://push.example.test/other"}'
    );
    raise exception 'mismatched push endpoint unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.items where id = current_setting('test.item_id')::uuid) then
    raise exception 'cross-household item leak';
  end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'cross-household profile leak';
  end if;
  if exists (select 1 from public.categories where household_id = current_setting('test.household_id')::uuid) then
    raise exception 'cross-household category leak';
  end if;
end;
$$;

select public.create_household('Outsider household') as outsider_household_id \gset
select c.id as outsider_category_id
from public.categories c
join public.category_positions cp
  on cp.category_id = c.id and cp.household_id = c.household_id
where c.household_id = :'outsider_household_id'::uuid
order by cp."position"
limit 1 \gset
select set_config('test.outsider_household_id', :'outsider_household_id', true);
select set_config('test.outsider_category_id', :'outsider_category_id', true);

reset role;
do $$
begin
  begin
    insert into public.items (household_id, category_id, name, quantity, unit)
    values (
      current_setting('test.household_id')::uuid,
      current_setting('test.outsider_category_id')::uuid,
      'Invalid category',
      1,
      'unite'
    );
    raise exception 'cross-household item category unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.household_members (household_id, user_id, role)
    values (
      current_setting('test.household_id')::uuid,
      '00000000-0000-4000-8000-000000000003',
      'member'
    );
    raise exception 'second household membership unexpectedly succeeded';
  exception when unique_violation then null;
  end;
end;
$$;

-- Ticket #106 iteration 4, C2 (PRD §5: 5 essais / 1 minute): lockout prouvé
-- sur foyer NON-PLEIN (1/2). Chemin connu-invalide (invitation révoquée) 5x
-- -> 22023 à chaque fois puis blocked_until setté -> 6e tentative P0001
-- 'temporarily locked' -> une invitation live fraîche reste consommable
-- (lockout par invitation, pas par foyer) et son succès reset
-- failed_attempts à 0 / blocked_until à NULL. La migration n'est pas touchée
-- (contrat seul) sauf bug avéré.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lockowner@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lockjoiner@example.test', '', now(), now());

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.create_household('Lockout household') as lock_household_id \gset
select * from public.create_household_invitation(:'lock_household_id'::uuid, interval '1 day') \gset lock_
select public.revoke_household_invitation(:'lock_invitation_id'::uuid) as lock_revoked_ok \gset
reset role;
select set_config('test.lock_household_id', :'lock_household_id', true);
select set_config('test.lock_id', :'lock_invitation_id', true);
select set_config('test.lock_token', :'lock_token', true);
select set_config('test.lock_revoked_ok', :'lock_revoked_ok', true);
do $$
begin
  if not current_setting('test.lock_revoked_ok')::boolean then
    raise exception 'lockout fixture could not revoke the invitation';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare i int;
begin
  for i in 1..5 loop
    begin
      perform public.consume_household_invitation(current_setting('test.lock_token'));
      raise exception 'revoked invitation unexpectedly consumed on attempt %', i;
    exception when sqlstate '22023' then null;
    end;
  end loop;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.household_invitations
    where id = current_setting('test.lock_id')::uuid
      and failed_attempts >= 5
      and blocked_until is not null
      and blocked_until > now()
  ) then raise exception 'lockout not armed after 5 attempts (failed_attempts/blocked_until)'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  begin
    perform public.consume_household_invitation(current_setting('test.lock_token'));
    raise exception 'locked invitation unexpectedly consumed on 6th attempt';
  exception when sqlstate 'P0001' then
    if position('temporarily locked' in sqlerrm) = 0 then
      raise exception 'wrong P0001 message for lockout: %', sqlerrm;
    end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select * from public.create_household_invitation(current_setting('test.lock_household_id')::uuid, interval '1 day') \gset lockvalid_
reset role;
select set_config('test.lockvalid_token', :'lockvalid_token', true);
select set_config('test.lockvalid_id', :'lockvalid_invitation_id', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.consume_household_invitation(current_setting('test.lockvalid_token')) as lock_joined_id \gset
reset role;
select set_config('test.lock_joined_id', :'lock_joined_id', true);
do $$
begin
  if current_setting('test.lock_joined_id')::uuid <> current_setting('test.lock_household_id')::uuid then
    raise exception 'valid invitation was blocked by a sibling lockout';
  end if;
  if not exists (
    select 1 from public.household_invitations
    where id = current_setting('test.lockvalid_id')::uuid
      and consumed_at is not null
      and failed_attempts = 0
      and blocked_until is null
  ) then raise exception 'successful consume did not reset failed_attempts/blocked_until'; end if;
  if not exists (
    select 1 from public.household_members
    where household_id = current_setting('test.lock_household_id')::uuid
      and user_id = '00000000-0000-4000-8000-000000000008'
      and role = 'member'
  ) then raise exception 'lockout success did not create member'; end if;
end;
$$;

reset role;

-- Debate C1: anonymous users cannot insert categories (nor anything else)
reset role;
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    insert into public.categories (household_id, name, is_default)
    values (current_setting('test.household_id')::uuid, 'Anon category', false);
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'anon inserted a category'; end if;
end;
$$;

reset role;
rollback;
