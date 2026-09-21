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
    -- units dropped in v1.1 §8: has_table_privilege errors when the table is
    -- gone (relation public.units does not exist), so skip absent tables.
    -- Generic guard keeps the contract green on converged chains while still
    -- asserting zero anon/PUBLIC grants wherever the table exists (pre-v1.1).
    if to_regclass('public.' || convergence_table) is null then
      continue;
    end if;
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
    'public.leave_household()',
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

-- Iteration 9 (cap 2/2, PRD §4.2 « automatiquement invalides »):
-- self-contained household. 004 creates, 005 joins (2/2 full), 006 attempts a
-- live token (pure 23505, row stays live — UPDATE+RAISE in one function is
-- undone by the caller's savepoint rollback), 005 leaves (1/2) → AFTER DELETE
-- trigger auto-invalidates the live row (consumed), the invalidated row stays
-- unusable without regen (22023), a regen lets 006 join.
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

-- A member leaves (2/2 → 1/2): the AFTER DELETE trigger invalidates the live
-- row at once (consumed_at/consumed_by set, CHECK pair kept).
delete from public.household_members
where household_id = current_setting('test.cap_household_id')::uuid
  and user_id = '00000000-0000-4000-8000-000000000005';

do $$
begin
  if not exists (
    select 1 from public.household_invitations
    where id = current_setting('test.capfull_id')::uuid
      and consumed_at is not null
  ) then raise exception 'departure did not auto-invalidate the live invitation (consumed)'; end if;
end;
$$;

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

-- Ticket #106 iteration 9, C2 (PRD §5: 5 essais / 1 minute): lockout prouvé
-- sur foyer NON-PLEIN (1/2). Chemin connu-invalide (invitation révoquée) 5x
-- -> 22023 à chaque fois. Note transactionnelle (même anti-pattern que le
-- cap itération 8) : UPDATE failed_attempts + RAISE 22023 dans la même
-- fonction, catché par le EXCEPTION du contrat (mono-transaction begin:2
-- rollback:907) => savepoint rollback défait l'incrément. Le harness
-- mono-transaction ne peut donc pas armer blocked_until par boucle catchée ;
-- on seed l'état bloqué directement pour prouver l'enforcement P0001
-- 'temporarily locked' -> une invitation live fraîche reste consommable
-- (lockout par invitation, pas par foyer) et son succès reset
-- failed_attempts à 0 / blocked_until à NULL. Migration inchangée (contrat
-- seul), cap non cassé.
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
-- Seed the armed lockout state (see note above): 5 failed attempts, blocked 1 minute.
-- Direct UPDATE as superuser (bypasses function-only RLS), car la boucle
-- catchée ne persiste pas l'incrément en mono-transaction.
update public.household_invitations
set failed_attempts = 5, blocked_until = now() + interval '1 minute'
where id = current_setting('test.lock_id')::uuid;
do $$
begin
  if not exists (
    select 1 from public.household_invitations
    where id = current_setting('test.lock_id')::uuid
      and failed_attempts >= 5
      and blocked_until is not null
      and blocked_until > now()
  ) then raise exception 'lockout seed did not arm (failed_attempts/blocked_until)'; end if;
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

-- Ticket #107 scope A — Fork ITEM_TEMPLATES + seeds + unites + validations (PRD §4.3/§4.4/§5/§7)
-- Seeds bilingues durs, fork isole, CHECK unit/seuil/nom, unicites CI, RESTRICT.
do $$
begin
  -- 1. Seeds : 10 categories + 10 templates, FR/EN, positions 1..10, unites fermees, seuils >0
  if (select count(*) from public.default_categories) <> 10 then
    raise exception 'seeds default_categories must be 10, got %', (select count(*) from public.default_categories);
  end if;
  if (select count(*) from public.item_templates) <> 10 then
    raise exception 'seeds item_templates must be 10, got %', (select count(*) from public.item_templates);
  end if;
  if exists (select 1 from public.default_categories where nullif(btrim(name_fr), '') is null or nullif(btrim(name_en), '') is null) then
    raise exception 'default_categories must be bilingual FR/EN';
  end if;
  if exists (select 1 from public.item_templates where nullif(btrim(name_fr), '') is null or nullif(btrim(name_en), '') is null) then
    raise exception 'item_templates must be bilingual FR/EN';
  end if;
  if (select count(*) from (select distinct "position" from public.default_categories) p) <> 10 then
    raise exception 'default_categories positions must be 10 distinct values';
  end if;
  if exists (select 1 from public.item_templates where unit not in ('kg', 'g', 'l', 'ml', 'unite')) then
    raise exception 'item_templates units must be closed (kg/g/l/ml/unite)';
  end if;
  if exists (select 1 from public.item_templates where suggested_threshold <= 0) then
    raise exception 'item_templates thresholds must be >0';
  end if;
  if exists (select 1 from public.item_templates it left join public.default_categories dc on dc.id = it.category_key where dc.id is null) then
    raise exception 'item_templates category_key must reference default_categories';
  end if;
end;
$$;

-- 2. Fork : qte 0, seuil=suggested, template_id indicatif, isolation inter-foyers (P0-5)
do $$
declare
  v_forked_test int;
  v_forked_outsider int;
begin
  select count(*) into v_forked_test from public.items
  where household_id = current_setting('test.household_id')::uuid and template_id is not null;
  if v_forked_test <> 10 then
    raise exception 'fork must create 10 items with template_id, got %', v_forked_test;
  end if;
  select count(*) into v_forked_outsider from public.items
  where household_id = current_setting('test.outsider_household_id')::uuid and template_id is not null;
  if v_forked_outsider <> 10 then
    raise exception 'outsider fork must create 10 items with template_id, got %', v_forked_outsider;
  end if;
  if exists (
    select 1 from public.items i join public.item_templates t on t.id = i.template_id
    where i.household_id = current_setting('test.household_id')::uuid
      and (i.quantity <> 0 or i.low_stock_threshold <> t.suggested_threshold or i.unit <> t.unit)
  ) then
    raise exception 'forked items must be qty 0, threshold=suggested, unit=template';
  end if;
  -- Isolation : renomme Lait foyer A, foyer B intact
  update public.items set name = 'Lait renomme'
  where household_id = current_setting('test.household_id')::uuid and lower(name) = lower('Lait');
  if not found then raise exception 'fork Lait copy missing in test household'; end if;
  if not exists (
    select 1 from public.items
    where household_id = current_setting('test.outsider_household_id')::uuid and name = 'Lait'
  ) then
    raise exception 'fork isolation broken: outsider Lait altered by test-household rename';
  end if;
  if exists (
    select 1 from public.items
    where household_id = current_setting('test.outsider_household_id')::uuid and name = 'Lait renomme'
  ) then
    raise exception 'fork isolation broken: rename leaked to outsider household';
  end if;
  -- Restaure pour la suite du contrat (rollback final de toute facon)
  update public.items set name = 'Lait'
  where household_id = current_setting('test.household_id')::uuid and name = 'Lait renomme';
end;
$$;

-- 3. CHECK unit fermees + seuil >0 + entier + nom (P1-7)
do $$
declare
  v_hid uuid := current_setting('test.household_id')::uuid;
  v_cid uuid := current_setting('test.item_category_id')::uuid;
begin
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, 'Check unit invalide', 1, 'pack', 1);
    raise exception 'invalid unit pack unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, 'Check seuil zero', 1, 'unite', 0);
    raise exception 'threshold 0 unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, 'Check seuil negatif', 1, 'unite', -2);
    raise exception 'negative threshold unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, 'Check qte decimale', 1.5, 'unite', 1);
    raise exception 'decimal quantity unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, '', 1, 'unite', 1);
    raise exception 'empty name unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, '12345', 1, 'unite', 1);
    raise exception 'no-letter name unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, repeat('A', 51), 1, 'unite', 1);
    raise exception 'over-50 name unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.categories (household_id, name, is_default)
    values (v_hid, '   ', false);
    raise exception 'blank category name unexpectedly accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- 4. Unicites CI (household_id, lower(name)) : items + categories custom (P1-7)
do $$
declare
  v_hid uuid := current_setting('test.household_id')::uuid;
  v_cid uuid := current_setting('test.item_category_id')::uuid;
  v_dup_cat uuid;
begin
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
    values (v_hid, v_cid, 'LAIT', 1, 'l', 1);
    raise exception 'duplicate item LAIT/lait unexpectedly accepted';
  exception when unique_violation then null;
  end;
  insert into public.categories (household_id, name, is_default)
  values (v_hid, 'Custom dup', false) returning id into v_dup_cat;
  begin
    insert into public.categories (household_id, name, is_default)
    values (v_hid, 'CUSTOM DUP', false);
    raise exception 'duplicate custom category unexpectedly accepted';
  exception when unique_violation then null;
  end;
  delete from public.categories where id = v_dup_cat;
end;
$$;

-- 5. ON DELETE RESTRICT categorie non-vide + message applicatif (PRD §5/§7)
-- DB : RESTRICT (23001) ou FK (23503) selon version ; app : "Déplacez ou supprimez d'abord les N articles".
do $$
declare
  v_hid uuid := current_setting('test.household_id')::uuid;
  v_cid uuid := current_setting('test.item_category_id')::uuid;
  v_empty uuid;
  v_n int;
begin
  if (select confdeltype from pg_constraint where conname = 'items_category_household_fkey') <> 'r' then
    raise exception 'items_category_household_fkey must be ON DELETE RESTRICT';
  end if;
  select count(*) into v_n from public.items where category_id = v_cid;
  if v_n = 0 then raise exception 'restrict fixture needs a non-empty category'; end if;
  begin
    delete from public.categories where id = v_cid;
    raise exception 'non-empty category deletion unexpectedly succeeded';
  exception when restrict_violation or foreign_key_violation then null;
  end;
  insert into public.categories (household_id, name, is_default)
  values (v_hid, 'Vide a supprimer', false) returning id into v_empty;
  delete from public.categories where id = v_empty;
  if not found then raise exception 'empty custom category was not deletable'; end if;
end;
$$;

-- 6. Catalogues : TO authenticated seul, lecture seule (0 ecriture client)
do $$
begin
  if not has_table_privilege('authenticated', 'public.default_categories', 'SELECT')
    or has_table_privilege('authenticated', 'public.default_categories', 'INSERT')
    or has_table_privilege('authenticated', 'public.default_categories', 'UPDATE')
    or has_table_privilege('authenticated', 'public.default_categories', 'DELETE') then
    raise exception 'default_categories must be read-only for authenticated';
  end if;
  if not has_table_privilege('authenticated', 'public.item_templates', 'SELECT')
    or has_table_privilege('authenticated', 'public.item_templates', 'INSERT')
    or has_table_privilege('authenticated', 'public.item_templates', 'UPDATE')
    or has_table_privilege('authenticated', 'public.item_templates', 'DELETE') then
    raise exception 'item_templates must be read-only for authenticated';
  end if;
end;
$$;

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

-- Ticket #108 — History 20 + already_notified + INSERT membre (PRD §4.6/§4.7/§5, fix #105)
-- Rotation AFTER INSERT (la 21e supprime la plus ancienne), 1 notif par
-- franchissement avec reset au-dessus du seuil, INSERT history réservé aux
-- membres de leur foyer (grants + RLS — les policies seules ne suffisaient pas).
do $$
begin
  -- action_type : modifs/suppressions uniquement — aucun achat.
  if (select coalesce(array_agg(e.enumlabel order by e.enumlabel), '{}')::text[]
      from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'action_type_enum')
     <> array['modification', 'suppression'] then
    raise exception 'history action_type must be exactly {modification, suppression}';
  end if;
  -- Aucune colonne avant/après : le contrat reste auteur+action+article+horodatage.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'history'
      and column_name not in ('id', 'household_id', 'performed_by', 'action_type', 'item_name', 'performed_at')
  ) then
    raise exception 'history must carry no before/after columns';
  end if;
  -- RLS active, 3 policies membres TO authenticated seul, aucun chemin UPDATE (log immuable).
  if not (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'history') then
    raise exception 'history RLS must stay enabled';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'history') <> 3 then
    raise exception 'history must carry exactly 3 member policies';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'history'
      and ('public' = any (roles) or 'anon' = any (roles) or cmd = 'UPDATE')
  ) then
    raise exception 'history policies must be member-only with no UPDATE path';
  end if;
  -- Trigger AFTER INSERT rotation présent et actif sur history.
  if not exists (
    select 1 from pg_trigger
    where tgname = 'history_cap_trigger' and tgrelid = 'public.history'::regclass and tgenabled = 'O'
  ) then
    raise exception 'history_cap_trigger must exist and be enabled';
  end if;
  -- history hors realtime (la publication exactement {categories, items} est assertée plus haut).
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'history'
  ) then
    raise exception 'history must stay out of supabase_realtime';
  end if;
  -- Grants : TO authenticated seul, sans UPDATE, sans écriture id/performed_at.
  -- INSERT vérifié au niveau colonnes (has_any_column_privilege) : la migration
  -- accorde INSERT colonnes uniquement, que has_table_privilege ignore.
  if not has_table_privilege('authenticated', 'public.history', 'SELECT')
     or not has_any_column_privilege('authenticated', 'public.history', 'INSERT')
     or not has_table_privilege('authenticated', 'public.history', 'DELETE')
     or has_table_privilege('authenticated', 'public.history', 'UPDATE')
     or has_table_privilege('anon', 'public.history', 'SELECT')
     or has_table_privilege('anon', 'public.history', 'INSERT')
     or has_table_privilege('public', 'public.history', 'SELECT')
     or has_table_privilege('public', 'public.history', 'INSERT') then
    raise exception 'history table grants must be SELECT/INSERT/DELETE to authenticated only';
  end if;
  if has_column_privilege('authenticated', 'public.history', 'id', 'INSERT')
     or has_column_privilege('authenticated', 'public.history', 'performed_at', 'INSERT')
     or not has_column_privilege('authenticated', 'public.history', 'household_id', 'INSERT')
     or not has_column_privilege('authenticated', 'public.history', 'performed_by', 'INSERT')
     or not has_column_privilege('authenticated', 'public.history', 'action_type', 'INSERT')
     or not has_column_privilege('authenticated', 'public.history', 'item_name', 'INSERT') then
    raise exception 'history column grants violate the append-only contract';
  end if;
  -- Fonction trigger interne non exécutable par les clients.
  if has_function_privilege('authenticated', 'public.cap_history()', 'EXECUTE') then
    raise exception 'trigger function cap_history is client-executable';
  end if;
  -- already_notified : colonne serveur NOT NULL défaut false, non inscriptible par les clients.
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'items' and column_name = 'already_notified') <> 'NO' then
    raise exception 'items.already_notified must be NOT NULL';
  end if;
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'items' and column_name = 'already_notified') is distinct from 'false' then
    raise exception 'items.already_notified default must be false';
  end if;
  if has_column_privilege('authenticated', 'public.items', 'already_notified', 'INSERT')
     or has_column_privilege('authenticated', 'public.items', 'already_notified', 'UPDATE') then
    raise exception 'already_notified must stay server-controlled';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'notify_threshold_crossing' and tgrelid = 'public.items'::regclass
  ) or not exists (
    select 1 from pg_trigger
    where tgname = 'notify_threshold_crossing_on_insert' and tgrelid = 'public.items'::regclass
  ) then
    raise exception 'threshold-crossing triggers must exist';
  end if;
end;
$$;

-- Fix #105 : un membre insère et lit l'historique de son foyer (0 warning 42501).
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.history (household_id, performed_by, action_type, item_name)
values (current_setting('test.household_id')::uuid, '00000000-0000-4000-8000-000000000002', 'modification', 'Lait');
do $$
begin
  if not exists (
    select 1 from public.history
    where household_id = current_setting('test.household_id')::uuid and item_name = 'Lait'
  ) then raise exception 'member could not read own household history'; end if;
  -- Log immuable : UPDATE refusé (aucun grant, aucune policy).
  begin
    update public.history set item_name = 'Forge' where item_name = 'Lait';
    raise exception 'history update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  -- Horodatage généré non inscriptible.
  begin
    insert into public.history (household_id, performed_by, action_type, item_name, performed_at)
    values (current_setting('test.household_id')::uuid, '00000000-0000-4000-8000-000000000002', 'modification', 'Date', now());
    raise exception 'history performed_at override unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  -- Achat : l'enum refuse tout autre type d'action.
  begin
    insert into public.history (household_id, performed_by, action_type, item_name)
    values (current_setting('test.household_id')::uuid, '00000000-0000-4000-8000-000000000002', 'achat', 'Lait');
    raise exception 'history purchase type unexpectedly accepted';
  exception when invalid_text_representation then null;
  end;
end;
$$;

-- Outsider : ni écriture ni lecture de l'historique d'un autre foyer.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare denied boolean := false;
begin
  begin
    insert into public.history (household_id, performed_by, action_type, item_name)
    values (current_setting('test.household_id')::uuid, '00000000-0000-4000-8000-000000000003', 'modification', 'Intrus');
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'outsider inserted foreign history'; end if;
  if exists (select 1 from public.history where household_id = current_setting('test.household_id')::uuid) then
    raise exception 'cross-household history leak';
  end if;
end;
$$;

-- Anon : aucune écriture d'historique.
reset role;
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    insert into public.history (household_id, performed_by, action_type, item_name)
    values (current_setting('test.household_id')::uuid, null, 'modification', 'Anon');
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'anon inserted history'; end if;
end;
$$;

-- Rotation §8 P1-10 : 21 inserts horodatés -> 20 gardées, la plus ancienne (H01) purgée.
-- En superuser (horodatage explicite déterministe) : le trigger purge quel que soit le rôle.
reset role;
do $$
declare
  v_hid uuid := current_setting('test.household_id')::uuid;
  i int;
begin
  delete from public.history where household_id = v_hid;
  for i in 1..21 loop
    insert into public.history (household_id, performed_by, action_type, item_name, performed_at)
    values (v_hid, '00000000-0000-4000-8000-000000000001',
      (case when i % 2 = 0 then 'suppression' else 'modification' end)::public.action_type_enum,
      'H' || lpad(i::text, 2, '0'), now() - (21 - i) * interval '1 minute');
  end loop;
  if (select count(*) from public.history where household_id = v_hid) <> 20 then
    raise exception 'history rotation must keep 20 rows';
  end if;
  if exists (select 1 from public.history where household_id = v_hid and item_name = 'H01') then
    raise exception 'history rotation did not drop the oldest row';
  end if;
  if not exists (select 1 from public.history where household_id = v_hid and item_name = 'H21') then
    raise exception 'history rotation dropped the newest row';
  end if;
end;
$$;

-- §8 P0-3 : baisser/remonter/rebaisser = 1 notif par passage (already_notified).
-- Sonde membro 002 : seuil 5, qté 10 -> -6 (notif 1) -> -1 (rien) -> +5 (reset) -> -4 (notif 2).
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
values (current_setting('test.household_id')::uuid, current_setting('test.item_category_id')::uuid, 'Probe notif', 10, 'unite', 5)
returning id as probe_item_id \gset
select set_config('test.probe_item_id', :'probe_item_id', true);
do $$
begin
  if (select already_notified from public.items where id = current_setting('test.probe_item_id')::uuid) then
    raise exception 'probe above threshold must start un-notified';
  end if;
end;
$$;
select quantity, already_notified from public.adjust_item_quantity(:'probe_item_id'::uuid, -6) \gset probe_down1_
select set_config('test.probe_down1_quantity', :'probe_down1_quantity', true);
select set_config('test.probe_down1_notified', :'probe_down1_already_notified', true);
select count(*) as pn from public.pending_notifications where item_id = :'probe_item_id'::uuid \gset probe_pn1_
select set_config('test.probe_pn1', :'probe_pn1_pn', true);
select actor_id as actor from public.pending_notifications where item_id = :'probe_item_id'::uuid order by created_at limit 1 \gset probe_actor_
select set_config('test.probe_actor', :'probe_actor_actor', true);
select quantity, already_notified from public.adjust_item_quantity(:'probe_item_id'::uuid, -1) \gset probe_down2_
select count(*) as pn from public.pending_notifications where item_id = :'probe_item_id'::uuid \gset probe_pn2_
select set_config('test.probe_pn2', :'probe_pn2_pn', true);
select quantity, already_notified from public.adjust_item_quantity(:'probe_item_id'::uuid, 5) \gset probe_up_
select set_config('test.probe_up_quantity', :'probe_up_quantity', true);
select set_config('test.probe_up_notified', :'probe_up_already_notified', true);
select quantity, already_notified from public.adjust_item_quantity(:'probe_item_id'::uuid, -4) \gset probe_down3_
select count(*) as pn from public.pending_notifications where item_id = :'probe_item_id'::uuid \gset probe_pn3_
select set_config('test.probe_pn3', :'probe_pn3_pn', true);
do $$
begin
  -- P0-2 : l'acteur du passage est enregistré (l'edge notifie l'autre membre, jamais l'acteur).
  if current_setting('test.probe_actor')::uuid <> '00000000-0000-4000-8000-000000000002' then
    raise exception 'threshold crossing must record its actor';
  end if;
  -- P0-3 : 1 notif au premier passage, aucune tant que ça reste sous le seuil, 1 au re-passage.
  if current_setting('test.probe_down1_quantity')::numeric <> 4
     or not current_setting('test.probe_down1_notified')::boolean
     or current_setting('test.probe_pn1')::bigint <> 1 then
    raise exception 'first threshold crossing must notify once';
  end if;
  if current_setting('test.probe_pn2')::bigint <> 1 then
    raise exception 'staying below threshold must not re-notify';
  end if;
  if current_setting('test.probe_up_quantity')::numeric <> 8
     or current_setting('test.probe_up_notified')::boolean then
    raise exception 'restock above threshold must reset already_notified';
  end if;
  if current_setting('test.probe_pn3')::bigint <> 2 then
    raise exception 'second threshold crossing must notify exactly once';
  end if;
end;
$$;

-- INSERT sous le seuil : notifié en foyer à 2 (un autre membre à prévenir) ...
insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
values (current_setting('test.household_id')::uuid, current_setting('test.item_category_id')::uuid, 'Probe bas duo', 2, 'unite', 5)
returning id as probe_duo_id \gset
select set_config('test.probe_duo_id', :'probe_duo_id', true);
do $$
begin
  if not (select already_notified from public.items where id = current_setting('test.probe_duo_id')::uuid) then
    raise exception 'below-threshold insert in a 2-member household must notify';
  end if;
  if (select count(*) from public.pending_notifications where item_id = current_setting('test.probe_duo_id')::uuid) <> 1 then
    raise exception 'below-threshold insert must queue exactly one notification';
  end if;
end;
$$;

-- ... ignoré en foyer solo (pas d'autre membre à prévenir, garde seed).
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
values (current_setting('test.outsider_household_id')::uuid, current_setting('test.outsider_category_id')::uuid, 'Probe bas solo', 1, 'unite', 5)
returning id as probe_solo_id \gset
select set_config('test.probe_solo_id', :'probe_solo_id', true);
do $$
begin
  if (select already_notified from public.items where id = current_setting('test.probe_solo_id')::uuid) then
    raise exception 'below-threshold insert in a single-member household must not notify';
  end if;
  if (select count(*) from public.pending_notifications where item_id = current_setting('test.probe_solo_id')::uuid) <> 0 then
    raise exception 'single-member insert must queue no notification';
  end if;
end;
$$;

-- Ticket #109 — Offline LWW silencieux (PRD §4.12/§5) : updated_at arbitre,
-- dernier gagne sans notification, RLS inchangée.
do $$
begin
  -- Schéma : updated_at NOT NULL DEFAULT now(), server-controlled.
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'items' and column_name = 'updated_at') <> 'NO' then
    raise exception 'items.updated_at must be NOT NULL';
  end if;
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'items' and column_name = 'updated_at') is distinct from 'now()' then
    raise exception 'items.updated_at default must be now()';
  end if;
  if has_column_privilege('authenticated', 'public.items', 'updated_at', 'INSERT')
     or has_column_privilege('authenticated', 'public.items', 'updated_at', 'UPDATE') then
    raise exception 'updated_at must stay server-controlled';
  end if;
  -- Touch trigger présent et actif sur items.
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trigger_update_last_modified' and tgrelid = 'public.items'::regclass and tgenabled = 'O'
  ) then
    raise exception 'trigger_update_last_modified must exist and be enabled';
  end if;
  -- Fonction trigger interne non exécutable par les clients.
  if has_function_privilege('authenticated', 'public.update_last_modified()', 'EXECUTE') then
    raise exception 'trigger function update_last_modified is client-executable';
  end if;
  -- Index resync (foyer, récence) pour le reload intégral à la reconnexion.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'items' and indexname = 'items_household_updated_idx'
  ) then
    raise exception 'items_household_updated_idx must exist';
  end if;
  -- RLS inchangée : exactement les 4 policies membres, TO authenticated seul.
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'items') <> 4 then
    raise exception 'items must carry exactly 4 member policies';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'items'
      and ('public' = any (roles) or 'anon' = any (roles))
  ) then
    raise exception 'items policies must stay TO authenticated only';
  end if;
end;
$$;

-- Probe LWW : 2 writers du même foyer, dernier gagne silencieux.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold)
values (current_setting('test.household_id')::uuid, current_setting('test.item_category_id')::uuid, 'LWW probe', 5, 'unite', 5)
returning id as lww_item_id \gset
select set_config('test.lww_item_id', :'lww_item_id', true);
select updated_at as lww_t0 from public.items where id = :'lww_item_id'::uuid \gset
select set_config('test.lww_t0', :'lww_t0', true);
-- updated_at forgé refusé (server-controlled : colonne hors grants INSERT).
do $$
begin
  begin
    insert into public.items (household_id, category_id, name, quantity, unit, low_stock_threshold, updated_at)
    values (current_setting('test.household_id')::uuid, current_setting('test.item_category_id')::uuid, 'LWW forged', 1, 'unite', 5, now() - interval '1 day');
    raise exception 'forged updated_at insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
-- Writer A (001) puis writer B (002) : aucune erreur, B écrase A silencieusement.
update public.items set name = 'Writer A' where id = current_setting('test.lww_item_id')::uuid;
select updated_at as lww_t1 from public.items where id = current_setting('test.lww_item_id')::uuid \gset
select set_config('test.lww_t1', :'lww_t1', true);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
update public.items set name = 'Writer B' where id = current_setting('test.lww_item_id')::uuid;
select updated_at as lww_t2 from public.items where id = current_setting('test.lww_item_id')::uuid \gset
select set_config('test.lww_t2', :'lww_t2', true);
-- updated_at forgé en UPDATE refusé lui aussi.
do $$
begin
  begin
    update public.items set updated_at = now() - interval '1 day' where id = current_setting('test.lww_item_id')::uuid;
    raise exception 'forged updated_at update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
-- Voie RPC (quantité) : les deux writers rejouent sans erreur, updated_at touché.
select quantity, updated_at from public.adjust_item_quantity(current_setting('test.lww_item_id')::uuid, 2) \gset lww_rpc1_
select set_config('test.lww_rpc1_quantity', :'lww_rpc1_quantity', true);
select set_config('test.lww_rpc1_updated', :'lww_rpc1_updated_at', true);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select quantity, updated_at from public.adjust_item_quantity(current_setting('test.lww_item_id')::uuid, -1) \gset lww_rpc2_
select set_config('test.lww_rpc2_quantity', :'lww_rpc2_quantity', true);
select set_config('test.lww_rpc2_updated', :'lww_rpc2_updated_at', true);
do $$
begin
  -- Dernier gagne silencieux : le nom de B est l'état visible, sans erreur levée.
  if not exists (
    select 1 from public.items
    where id = current_setting('test.lww_item_id')::uuid
      and name = 'Writer B'
  ) then raise exception 'LWW did not keep the last writer silently'; end if;
  -- Touch trigger : chaque écriture enregistre son acteur (ici le dernier replay RPC par 001).
  if not exists (
    select 1 from public.items
    where id = current_setting('test.lww_item_id')::uuid
      and last_modified_by = '00000000-0000-4000-8000-000000000001'
  ) then raise exception 'touch trigger did not record the last writer'; end if;
  -- Touch trigger : updated_at renseigné et monotone (contrat mono-transaction :
  -- now() = début de transaction, donc >= et non > strict).
  if current_setting('test.lww_t1')::timestamptz < current_setting('test.lww_t0')::timestamptz
     or current_setting('test.lww_t2')::timestamptz < current_setting('test.lww_t1')::timestamptz
     or current_setting('test.lww_rpc2_updated')::timestamptz < current_setting('test.lww_t2')::timestamptz then
    raise exception 'updated_at must be touched monotonically on every write';
  end if;
  -- Voie RPC rejouée sans conflit : 5 + 2 - 1 = 6.
  if current_setting('test.lww_rpc2_quantity')::numeric <> 6 then
    raise exception 'sequential RPC replays did not converge';
  end if;
end;
$$;

-- Isolation inchangée : outsider sans effet, anon refusé.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  update public.items set name = 'Intrus' where id = current_setting('test.lww_item_id')::uuid;
  if found then raise exception 'cross-household LWW leak'; end if;
end;
$$;
reset role;
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    update public.items set name = 'Anon' where id = current_setting('test.lww_item_id')::uuid;
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'anon updated an item'; end if;
end;
$$;

-- Ticket #110 — Compte/foyer lifecycle : quitter, soft-delete 7j, cascade (PRD §4.8/§4.9/§5)
-- leave_household : départ volontaire (le partant perd l'accès, l'autre garde
-- tout indéfini), idempotent ; foyer à 0 membre → cascade custom/items/history,
-- templates/défauts intacts ; sweep >7j purge (service_role seul), <7j retenu ;
-- TO authenticated seul, anon refusé.
reset role;
-- Lifecycle fixtures use fresh ids 011-014 (007/008 already taken by the
-- lockout fixtures above; household_members.user_id is unique single-household).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leaver@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joiner@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'purged@example.test', '', now(), now()),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retained@example.test', '', now(), now());
do $$
begin
  if (select count(*) from public.profiles where id::text in (
    '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000014')) <> 4 then
    raise exception 'signup must create lifecycle profiles';
  end if;
  -- profiles.deleted_at : colonne de rétention RGPD, nullable (grâce restorable).
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'deleted_at') <> 'YES' then
    raise exception 'profiles.deleted_at must stay nullable (grace restorable)';
  end if;
end;
$$;

-- 011 creates the lifecycle household (fork 10 categories + 10 items).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.create_household('Lifecycle household') as lifecycle_household_id \gset
select * from public.create_household_invitation(:'lifecycle_household_id'::uuid, interval '1 day') \gset lc_
reset role;
select set_config('test.lifecycle_household_id', :'lifecycle_household_id', true);
select set_config('test.lc_token', :'lc_token', true);

-- 012 joins via the live invitation.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.consume_household_invitation(current_setting('test.lc_token')) as lc_joined_id \gset
reset role;
select set_config('test.lc_joined_id', :'lc_joined_id', true);
do $$
begin
  if current_setting('test.lc_joined_id')::uuid <> current_setting('test.lifecycle_household_id')::uuid then
    raise exception 'lifecycle join reached the wrong household';
  end if;
end;
$$;

-- 011 seeds household-owned rows covered by the 0-member cascade.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.categories (household_id, name, is_default)
values (current_setting('test.lifecycle_household_id')::uuid, 'Lifecycle custom', false)
returning id as lc_custom_cat_id \gset
insert into public.items (household_id, category_id, name, quantity, unit)
values (current_setting('test.lifecycle_household_id')::uuid, :'lc_custom_cat_id'::uuid, 'Lifecycle item', 1, 'unite');
insert into public.history (household_id, performed_by, action_type, item_name)
values (current_setting('test.lifecycle_household_id')::uuid, '00000000-0000-4000-8000-000000000011', 'modification', 'Lifecycle item');
reset role;

-- anon cannot leave (TO authenticated seul).
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    perform public.leave_household();
  exception when sqlstate '42501' then denied := true;
  end;
  if not denied then raise exception 'anon left a household'; end if;
end;
$$;
reset role;

-- 012 leaves: true, then idempotent false. 011 untouched (jamais retirable).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.leave_household() as lc_left1 \gset
select public.leave_household() as lc_left2 \gset
reset role;
select set_config('test.lc_left1', :'lc_left1', true);
select set_config('test.lc_left2', :'lc_left2', true);
do $$
begin
  if not current_setting('test.lc_left1')::boolean then raise exception 'first leave_household must return true'; end if;
  if current_setting('test.lc_left2')::boolean then raise exception 'second leave_household must return false (idempotent)'; end if;
  if exists (
    select 1 from public.household_members where user_id = '00000000-0000-4000-8000-000000000012'
  ) then raise exception 'leaver membership was not removed'; end if;
  if not exists (
    select 1 from public.household_members
    where household_id = current_setting('test.lifecycle_household_id')::uuid
      and user_id = '00000000-0000-4000-8000-000000000011'
  ) then raise exception 'leave removed the wrong member'; end if;
end;
$$;

-- Leaver loses inventory + household access; the other member keeps everything.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.items where household_id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'leaver kept inventory access';
  end if;
  if exists (select 1 from public.households where id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'leaver kept household access';
  end if;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  -- Autre membre intact, sans limite de durée : fork + custom + history présents.
  if (select count(*) from public.items where household_id = current_setting('test.lifecycle_household_id')::uuid) <> 11 then
    raise exception 'remaining member lost forked or custom items';
  end if;
  if (select count(*) from public.categories where household_id = current_setting('test.lifecycle_household_id')::uuid) <> 11 then
    raise exception 'remaining member lost categories';
  end if;
  if not exists (
    select 1 from public.history
    where household_id = current_setting('test.lifecycle_household_id')::uuid and item_name = 'Lifecycle item'
  ) then raise exception 'remaining member lost history'; end if;
  -- Le partant n'est plus visible (plus de foyer partagé).
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000012') then
    raise exception 'leaver profile still visible to the remaining member';
  end if;
end;
$$;
reset role;

-- 011 leaves last: 0 membre → cascade custom/items/history, foyer supprimé.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.leave_household() as lc_left_last \gset
reset role;
select set_config('test.lc_left_last', :'lc_left_last', true);
do $$
begin
  if not current_setting('test.lc_left_last')::boolean then raise exception 'last leave_household must return true'; end if;
  if exists (select 1 from public.households where id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'orphan household was not purged';
  end if;
  if exists (select 1 from public.items where household_id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'orphan items were not cascaded';
  end if;
  if exists (select 1 from public.categories where household_id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'orphan categories were not cascaded';
  end if;
  if exists (select 1 from public.history where household_id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'orphan history was not cascaded';
  end if;
  if exists (select 1 from public.household_invitations where household_id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'orphan invitations were not cascaded';
  end if;
  if exists (select 1 from public.pending_notifications where household_id = current_setting('test.lifecycle_household_id')::uuid) then
    raise exception 'orphan pending notifications were not cascaded';
  end if;
  -- Templates + défauts intacts (aucun FK foyer).
  if (select count(*) from public.default_categories) <> 10 then
    raise exception 'default_categories were affected by the orphan purge';
  end if;
  if (select count(*) from public.item_templates) <> 10 then
    raise exception 'item_templates were affected by the orphan purge';
  end if;
  -- FK foyer → ON DELETE CASCADE ; catégorie non-vide → RESTRICT préservé.
  if exists (
    select 1 from pg_constraint
    where conrelid in ('public.items'::regclass, 'public.categories'::regclass, 'public.history'::regclass,
                       'public.category_positions'::regclass, 'public.pending_notifications'::regclass,
                       'public.household_invitations'::regclass, 'public.household_members'::regclass)
      and contype = 'f' and confrelid = 'public.households'::regclass
      and confdeltype <> 'c'
  ) then raise exception 'household FKs must stay ON DELETE CASCADE'; end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_category_household_fkey' and confdeltype = 'r'
  ) then raise exception 'non-empty category delete must stay RESTRICT'; end if;
end;
$$;

-- Soft-delete fixtures: 013 au-delà de 7j (purgé), 014 dans la grâce (retenu).
update public.profiles set deleted_at = now() - interval '8 days' where id = '00000000-0000-4000-8000-000000000013';
update public.profiles set deleted_at = now() - interval '1 day' where id = '00000000-0000-4000-8000-000000000014';

-- authenticated ne peut pas purger (service_role seul).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare denied boolean := false;
begin
  begin
    perform public.sweep_fully_deleted_members();
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'authenticated purged soft-deleted accounts'; end if;
end;
$$;
reset role;

-- Sweep >7j : purge 013, retient 014, idempotent (2e passage → 0).
select public.sweep_fully_deleted_members() as lc_sweep1 \gset
select set_config('test.lc_sweep1', :'lc_sweep1', true);
do $$
begin
  if current_setting('test.lc_sweep1')::int <> 1 then
    raise exception 'sweep must purge exactly the >7j account, got %', current_setting('test.lc_sweep1');
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000013') then
    raise exception 'sweep did not delete the >7j auth user';
  end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000013') then
    raise exception 'sweep left an orphan >7j profile';
  end if;
  if not exists (
    select 1 from auth.users where id = '00000000-0000-4000-8000-000000000014'
  ) then raise exception 'sweep purged an account inside the 7-day grace'; end if;
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000014' and deleted_at is not null
  ) then raise exception 'sweep cleared a grace-period deleted_at'; end if;
end;
$$;
select public.sweep_fully_deleted_members() as lc_sweep2 \gset
select set_config('test.lc_sweep2', :'lc_sweep2', true);
do $$
begin
  if current_setting('test.lc_sweep2')::int <> 0 then
    raise exception 'sweep must be idempotent (second run returns 0)';
  end if;
end;
$$;

-- Annulation par reconnexion <7j : l'utilisateur remet deleted_at à NULL.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare
  v_uid uuid;
  v_select_count int;
  v_update_display_count int;
  v_update_deleted_count int;
begin
  v_uid := (select auth.uid());
  raise notice 'DIAG2 uid=%', v_uid;
  -- SELECT as authenticated (should be 0 for houseless due to can_view_profile, proving app fetchProfile bug)
  select count(*) into v_select_count from public.profiles where id = '00000000-0000-4000-8000-000000000014';
  raise notice 'DIAG2 select_count_as_authenticated=%', v_select_count;
  -- Try updating display_name as 014 (same RLS, different column) to isolate column vs houseless
  update public.profiles set display_name = 'Diag' where id = '00000000-0000-4000-8000-000000000014';
  get diagnostics v_update_display_count = row_count;
  raise notice 'DIAG2 update_display_name_rowcount=%', v_update_display_count;
  -- Try updating deleted_at (the failing case) with row_count logging instead of FOUND
  update public.profiles set deleted_at = null where id = '00000000-0000-4000-8000-000000000014';
  get diagnostics v_update_deleted_count = row_count;
  raise notice 'DIAG2 update_deleted_at_rowcount=%', v_update_deleted_count;
  if v_update_deleted_count = 0 then raise exception 'grace-period account could not clear deleted_at'; end if;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000014' and deleted_at is not null) then
    raise exception 'account restoration did not clear deleted_at';
  end if;
end;
$$;

reset role;
rollback;
