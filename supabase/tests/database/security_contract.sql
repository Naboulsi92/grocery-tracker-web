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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
  ) or not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    raise exception 'inventory tables must be published to Realtime';
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in (
        'households', 'household_members', 'profiles', 'household_invitations',
        'push_subscriptions', 'units'
      )
  ) then
    raise exception 'non-inventory application tables must not be published to Realtime';
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
    'public.adjust_item_quantity(uuid,numeric)'
  ] loop
    if has_function_privilege('anon', function_signature, 'EXECUTE') then
      raise exception 'anon can execute %', function_signature;
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
    or not has_column_privilege('authenticated', 'public.items', 'quantity', 'INSERT') then
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
    or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') then
    raise exception 'authenticated can write generated identifiers or timestamps';
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
  if (select count(*) from public.categories where household_id = current_setting('test.household_id')::uuid) <> 6 then
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

select * from public.create_household_invitation(:'household_id'::uuid, interval '1 day') \gset invite_
select * from public.create_household_invitation(:'household_id'::uuid, interval '1 day') \gset revoked_
select * from public.create_household_invitation(:'household_id'::uuid, interval '1 day') \gset occupied_
select public.revoke_household_invitation(:'revoked_invitation_id'::uuid) as revoked_ok \gset
reset role;
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
set local role authenticated;

do $$
begin
  if length(current_setting('test.invite_token')) < 30 then raise exception 'invitation token is too short'; end if;
  if not current_setting('test.revoked_ok')::boolean then raise exception 'owner could not revoke invitation'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.consume_household_invitation(:'invite_token') as joined_household_id \gset
reset role;
select set_config('test.joined_household_id', :'joined_household_id', true);
set local role authenticated;

do $$
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
  begin
    perform public.consume_household_invitation(current_setting('test.invite_token'));
    raise exception 'consumed invitation unexpectedly reused';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.consume_household_invitation(current_setting('test.revoked_token'));
    raise exception 'revoked invitation unexpectedly consumed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.consume_household_invitation(current_setting('test.expired_token'));
    raise exception 'expired invitation unexpectedly consumed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.consume_household_invitation('unknown-token');
    raise exception 'unknown invitation unexpectedly consumed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_household_invitation(current_setting('test.household_id')::uuid, interval '1 day');
    raise exception 'member unexpectedly issued an invitation';
  exception when insufficient_privilege then null;
  end;
  update public.households set name = 'Member rename' where id = current_setting('test.household_id')::uuid;
  if found then raise exception 'member unexpectedly renamed household'; end if;
  begin
    perform 1 from public.household_invitations limit 1;
    raise exception 'member unexpectedly read invitation storage';
  exception when insufficient_privilege then null;
  end;
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
    where token_hash = sha256(convert_to(current_setting('test.occupied_token'), 'UTF8'))
      and consumed_at is not null
  ) then raise exception 'failed invitation consumption consumed its token'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
update public.households set name = 'Renamed household' where id = :'household_id' returning name \gset renamed_
reset role;
select set_config('test.renamed_name', :'renamed_name', true);

reset role;
select id as unit_id from public.units limit 1 \gset
select set_config('test.unit_id', :'unit_id', true);
insert into public.items (household_id, name, quantity, unit_id)
values (:'household_id', 'Milk', 1, :'unit_id') returning id as item_id \gset
select set_config('test.item_id', :'item_id', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select quantity, last_modified_by from public.adjust_item_quantity(:'item_id'::uuid, -5) \gset adjusted_
reset role;
select set_config('test.adjusted_quantity', :'adjusted_quantity', true);
select set_config('test.adjusted_user', :'adjusted_last_modified_by', true);
set local role authenticated;

insert into public.items (household_id, name, quantity, unit_id)
values (:'household_id', 'Bread', 2, :'unit_id') returning id as inserted_item_id \gset
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
select id as outsider_category_id
from public.categories
where household_id = :'outsider_household_id'::uuid
order by "order"
limit 1 \gset
select set_config('test.outsider_household_id', :'outsider_household_id', true);
select set_config('test.outsider_category_id', :'outsider_category_id', true);

reset role;
do $$
begin
  begin
    insert into public.items (household_id, category_id, name, quantity, unit_id)
    values (
      current_setting('test.household_id')::uuid,
      current_setting('test.outsider_category_id')::uuid,
      'Invalid category',
      1,
      current_setting('test.unit_id')::uuid
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

reset role;
rollback;
